import assert from "node:assert/strict";
import test from "node:test";
import { createOcrHarness } from "./helpers/ocr-handler.mjs";

// Permanent regression coverage for the 15 synthetic cases from the investigation.
const cases = [
  ["NO_PLATE", null], ["NOPLATE", null], ["NO PLATE", null],
  [" no plate ", null], ["NO  PLATE", null],
  ["HAB8580", "HAB8580"], ["HAB-8580", "HAB8580"], ["NO1234", "NO1234"],
  ...["UNKNOWN", "NO-PLATE", "NO_PLATE.", "There is no plate", "NOPLATE123", "HAB8580 EXTRA", ""].map((text) => [text, undefined]),
];
for (const [text, plate] of cases) {
  test(`OCR regression ${JSON.stringify(text)}`, async () => {
    const run = createOcrHarness({ text });
    const response = await run.invoke();
    assert.equal(run.providerCalls, 1);
    assert.equal(run.usage.length, 1);
    assert.equal(run.usage[0].p_input_tokens, 10);
    if (plate !== undefined) {
      assert.equal(response.status, 200);
      assert.equal(response.body.plate_text, plate);
      assert.equal(run.entry.vehicle_plate_text, plate);
      assert.equal(run.queue.status, "DONE");
      assert.ok(run.queue.completed_at);
      assert.equal(run.queue.last_error, null);
      assert.equal(run.queue.attempts, 0);
      assert.deepEqual(run.events, ["persisted", "trigger:DONE"]);
      assert.equal(run.usage[0].p_status, "success");
      assert.equal(run.usage[0].p_metadata.result_kind, plate ? "plate" : "no_plate");
      await run.invoke();
      assert.equal(run.providerCalls, 1, "a duplicate completed job must not rebill Gemini");
    } else {
      assert.equal(response.status, 502);
      assert.equal(run.queue.status, "FAILED");
      assert.equal(run.queue.last_error, "OCR_INVALID_OUTPUT");
      assert.equal(run.writes, 0);
      assert.equal(run.usage[0].p_status, "failed");
      await run.invoke();
      assert.equal(run.providerCalls, 1, "terminal output errors must not retry");
    }
  });
}

test("unknown separators, invalid plates, prose and thoughts never become no-plate results", async () => {
  for (const text of ["NO_ PLATE", "N O P L A T E", "N/A", "NONE", "NULL", "SIN PLACA", "NO\u200bPLATE", "A1234", "ABCDE1234", "AB12", "AB123456", "Plate: HAB8580", "NO_PLATE because no plate is visible"]) {
    const run = createOcrHarness({ text });
    assert.equal((await run.invoke()).status, 502, text);
    assert.equal(run.queue.last_error, "OCR_INVALID_OUTPUT", text);
    assert.equal(run.writes, 0, text);
  }
  const run = createOcrHarness({ payload: { candidates: [{ content: { parts: [{ text: "NO_PLATE", thought: true }] } }] } });
  assert.equal((await run.invoke()).status, 502);
  assert.equal(run.writes, 0);
});

test("malformed candidate shapes remain visible failures rather than no-plate success", async () => {
  for (const payload of [{}, { candidates: [] }, { candidates: [{ content: { parts: "NO_PLATE" } }] }, { candidates: [{ content: { parts: [null] } }] }, { candidates: [{ content: { parts: [{ text: 123 }] } }] }]) {
    const run = createOcrHarness({ payload });
    assert.equal((await run.invoke()).status, 502);
    assert.equal(run.queue.last_error, "OCR_INVALID_OUTPUT");
    assert.equal(run.writes, 0);
  }
});

for (const status of ["PENDING", "PROCESSING"]) {
  test(`${status} completes all allowed sentinels after verified null persistence`, async () => {
    for (const text of ["NO_PLATE", "NOPLATE", "NO PLATE"]) {
      const run = createOcrHarness({ status, text });
      assert.equal((await run.invoke()).status, 200);
      assert.equal(run.queue.status, "DONE");
      assert.equal(run.writes, 1);
      assert.deepEqual(run.events, ["persisted", "trigger:DONE"]);
    }
  });
}

for (const status of ["DONE", "FAILED"]) {
  test(`${status} stays terminal before dispatch and after a late success or failure`, async () => {
    const terminal = createOcrHarness({ status });
    assert.equal((await terminal.invoke()).body.skipped, true);
    assert.equal(terminal.providerCalls, 0);
    for (const outcome of [{ text: "NOPLATE" }, { text: "HAB8580" }, { text: "UNKNOWN" }, { networkError: true }]) {
      const run = createOcrHarness({ ...outcome, duringProvider: (state) => { state.queue.status = status; } });
      await run.invoke();
      assert.equal(run.queue.status, status);
      assert.equal(run.writes, 0);
      assert.equal(run.usage.length, 1, "late provider usage is still accounted");
    }
  });
}

for (const [options, error, retry] of [
  [{ networkError: true }, "GEMINI_NETWORK_ERROR", true],
  [{ networkError: "timeout" }, "GEMINI_NETWORK_ERROR", true],
  [{ invalidJson: true }, "GEMINI_INVALID_RESPONSE", true],
  [{ httpStatus: 408 }, "GEMINI_HTTP_408", true],
  [{ httpStatus: 429 }, "GEMINI_HTTP_429", true],
  [{ httpStatus: 503 }, "GEMINI_HTTP_503", true],
  [{ httpStatus: 400 }, "GEMINI_HTTP_400", false],
  [{ httpStatus: 401 }, "GEMINI_HTTP_401", false],
]) {
  test(`${error} is accounted and ${retry ? "bounded retry" : "terminal"}, never no-plate`, async () => {
    for (const attempts of [1, 5]) {
      const run = createOcrHarness({ ...options, attempts, status: "PROCESSING", text: "NO_PLATE" });
      assert.equal((await run.invoke()).status, 502);
      assert.equal(run.queue.status, retry && attempts < 5 ? "PENDING" : "FAILED");
      assert.equal(run.queue.last_error, error);
      assert.equal(run.writes, 0);
      assert.equal(run.providerCalls, 1);
      assert.equal(run.usage[0].p_error_code, error);
      assert.equal(run.usage[0].p_metadata.result_kind, "unknown");
      if (retry && attempts < 5) assert.ok(Date.parse(run.queue.scheduled_at) > Date.now() + 110_000);
    }
  });
}

for (const persist of ["error", "throw", "zero"]) {
  test(`persistence ${persist} cannot complete an OCR job`, async () => {
    const run = createOcrHarness({ persist, status: "PROCESSING", text: "NOPLATE" });
    assert.equal((await run.invoke()).status, 500);
    assert.equal(run.queue.status, "PENDING");
    assert.equal(run.queue.last_error, "OCR_PERSIST_FAILED");
    assert.equal(run.queue.completed_at, null);
    assert.equal(run.writes, 0);
    assert.ok(run.events.includes("log_system_event"));
    assert.equal(run.usage.length, 1, "successful provider usage is retained despite a persistence error");
  });
}

test("late no-plate response cannot overwrite a plate or a replaced photograph", async () => {
  for (const beforePersist of [
    (state) => { state.entry.vehicle_plate_text = "HAB8580"; },
    (state) => { state.entry.vehicle_photo_path = "replacement.jpg"; },
  ]) {
    const run = createOcrHarness({ beforePersist });
    assert.equal((await run.invoke()).status, 500);
    assert.equal(run.writes, 0);
    assert.equal(run.queue.status, "PENDING");
  }
});

test("a FAILED race at persistence cannot be promoted by the explicit completion update", async () => {
  const run = createOcrHarness({ beforePersist: (state) => { state.queue.status = "FAILED"; } });
  assert.equal((await run.invoke()).body.skipped, true);
  assert.equal(run.queue.status, "FAILED");
  assert.equal(run.queue.completed_at, null);
});

test("an unconfirmed completion is visible without reopening an already committed job", async () => {
  const run = createOcrHarness({ completionLookupError: true });
  assert.equal((await run.invoke()).status, 503);
  assert.equal(run.queue.status, "DONE");
  assert.equal(run.providerCalls, 1);
  assert.equal(run.queue.last_error, null);
});

test("storage failures stay distinct from valid no-plate output", async () => {
  for (const [statusCode, expectedStatus, expectedError] of [[404, "FAILED", "OCR_IMAGE_NOT_FOUND"], [503, "PENDING", "OCR_IMAGE_DOWNLOAD_FAILED"]]) {
    const run = createOcrHarness({ storageError: { statusCode } });
    assert.equal((await run.invoke()).status, 500);
    assert.equal(run.queue.status, expectedStatus);
    assert.equal(run.queue.last_error, expectedError);
    assert.equal(run.providerCalls, 0);
    assert.equal(run.writes, 0);
  }
});

test("lost commit acknowledgement and best-effort queue error never reopen a committed DONE", async () => {
  for (const options of [{ persist: "lost-ack" }, { queueDoneError: true }]) {
    const run = createOcrHarness(options);
    await run.invoke();
    assert.equal(run.queue.status, "DONE");
    assert.equal(run.queue.last_error, null);
    assert.equal(run.writes, 1);
    await run.invoke();
    assert.equal(run.providerCalls, 1);
  }
});

test("authorization, image binding and unavailable queue fail before billing or persistence", async () => {
  const invalidToken = createOcrHarness();
  assert.equal((await invalidToken.invoke({ token: "invalid" })).status, 403);
  assert.equal(invalidToken.providerCalls, 0);
  for (const role of ["anon", "authenticated", "guard", "admin"]) {
    const run = createOcrHarness();
    assert.equal((await run.invoke({ role })).status, 403);
    assert.equal(run.providerCalls, 0);
  }
  for (const options of [{ missingQueue: true }, { queueLookupError: true }, { status: "UNKNOWN" }]) {
    const run = createOcrHarness(options);
    assert.equal((await run.invoke()).status, 503);
    assert.equal(run.providerCalls, 0);
    assert.equal(run.writes, 0);
  }
  const imageMismatch = createOcrHarness();
  assert.equal((await imageMismatch.invoke({ body: { entry_log_id: "entry-fixture", image_path: "other.jpg" } })).status, 400);
  assert.equal(imageMismatch.providerCalls, 0);
});

test("prompt covers reference photos; usage and logs do not contain provider text or image", async () => {
  const run = createOcrHarness({ text: "There is no plate" });
  await run.invoke();
  const prompt = run.requests[0].contents[0].parts[1].text;
  assert.match(prompt, /vehicle without a plate/);
  assert.match(prompt, /photograph taken only as a reference/);
  assert.match(prompt, /output exactly NO_PLATE/);
  const telemetry = JSON.stringify([run.usage, run.logs]);
  for (const privateValue of ["There is no plate", "synthetic image", "fixture-gemini-key", "fixture-service-key"]) {
    assert.ok(!telemetry.includes(privateValue));
  }
});
