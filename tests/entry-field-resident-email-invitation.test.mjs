import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import * as React from "react";

const action = readFileSync(
  "features/entry/field/quickResidentInviteActions.ts",
  "utf8",
);
const form = readFileSync(
  "features/entry/field/FieldQuickResidentForm.tsx",
  "utf8",
);
const immediate = readFileSync(
  "features/entry/field/quickResidentActions.ts",
  "utf8",
);

function load(source, imports) {
  const exports = {};
  const compiled = ts.transpile(source, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
  });
  new Function("require", "exports", "React", compiled)(
    (name) => {
      assert.ok(name in imports, `known import ${name}`);
      return imports[name];
    },
    exports,
    React,
  );
  return exports;
}

function inviteHarness(options = {}) {
  const calls = [];
  const data = options.data || {
    success: true,
    queue_id: "queue-1",
    created: true,
    status: "pending",
    email: "resident@example.com",
    resident_name: "Resident",
    unit_label: "10",
    community_name: "Canonical community",
  };
  const exports = load(action, {
    "next/cache": {
      revalidatePath: (path) => calls.push(["revalidate", path]),
    },
    "@/features/auth/requireSuperadmin": {
      requireSuperadmin: async () => {
        calls.push(["authorize"]);
        if (options.unauthorized) throw new Error("Unauthorized");
      },
    },
    "@/features/entry/deploymentBoundary": {
      getEntryPreviewReadOnlyError: () =>
        options.preview ? "Preview read only" : null,
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (name, args) => {
          calls.push(["rpc", name, args]);
          return { data, error: options.error || null };
        },
      }),
    },
    "@/features/entry/activation/emailActions": {
      sendActivationEmails: async (input) => {
        calls.push(["email", input]);
        if (options.throwDelivery) throw new Error("Delivery interrupted");
        return (
          options.delivery || {
            success: true,
            data: {
              items: [{ queue_id: "queue-1", status: "sent" }],
              metadata_persisted: true,
            },
          }
        );
      },
    },
  });
  return { calls, invite: exports.inviteFieldQuickResident };
}

const input = {
  communityId: "community-1",
  unitId: "house-1",
  fullName: "Resident",
  email: " Resident@Example.com ",
  phone: "",
};

test("invite requires a valid email and never needs a password", async () => {
  for (const email of ["", "  ", "invalid", "x".repeat(255) + "@example.com"]) {
    const harness = inviteHarness();
    assert.equal((await harness.invite({ ...input, email })).success, false);
    assert.equal(
      harness.calls.some(([name]) => name === "rpc"),
      false,
    );
  }
  assert.equal((await inviteHarness().invite(input)).emailSent, true);
  assert.doesNotMatch(
    action,
    /inviteUserByEmail|createUser\(|createAdminClient|password|\.insert\(/,
  );
});

test("invite uses shared preparation and canonical email flow with server-derived context", async () => {
  const harness = inviteHarness();
  const result = await harness.invite(input);
  assert.equal(result.queueId, "queue-1");
  const rpc = harness.calls.find(([name]) => name === "rpc");
  assert.equal(rpc[1], "prepare_resident_activation_invite_v1");
  assert.equal(rpc[2].p_house_id, "house-1");
  assert.equal(rpc[2].p_community_id, "community-1");
  assert.equal(rpc[2].p_email, "resident@example.com");
  assert.deepEqual(harness.calls.find(([name]) => name === "email")[1], {
    communityId: "community-1",
    communityName: "Canonical community",
    queueIds: ["queue-1"],
  });
  assert.ok(
    harness.calls.find(
      ([name, path]) =>
        name === "revalidate" && path === "/products/entry/activation",
    ),
  );
  assert.ok(
    harness.calls.find(
      ([name, path]) =>
        name === "revalidate" && path.endsWith("/people/units/house-1"),
    ),
  );
});

test("house boundaries, active account and incompatible queue conflicts stop delivery", async () => {
  for (const error of [
    "house_not_in_community",
    "house_inactive",
    "email_already_registered",
    "resident_activation_conflict",
  ]) {
    const harness = inviteHarness({ data: { success: false, error } });
    const result = await harness.invite(input);
    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.equal(
      harness.calls.some(([name]) => name === "email"),
      false,
    );
  }
});

test("reused pending/invited/PIN/failed queue rows never automatically resend", async () => {
  for (const status of ["pending", "invited", "pin_generated", "failed"]) {
    const harness = inviteHarness({
      data: {
        success: true,
        created: false,
        status,
        queue_id: "existing-queue",
      },
    });
    const result = await harness.invite(input);
    assert.equal(result.queueId, "existing-queue");
    assert.equal(result.emailSent, false);
    assert.ok(result.warning);
    assert.equal(
      harness.calls.some(([name]) => name === "email"),
      false,
    );
  }
});

test("delivery failures preserve retryable prepared state and never claim sent", async () => {
  for (const options of [
    { delivery: { success: false, error: "Resend unavailable" } },
    {
      delivery: {
        success: true,
        data: { items: [{ queue_id: "queue-1", status: "failed" }] },
      },
    },
    { throwDelivery: true },
  ]) {
    const result = await inviteHarness(options).invite(input);
    assert.equal(result.success, true);
    assert.equal(result.emailSent, false);
    assert.equal(result.queueId, "queue-1");
    assert.match(result.warning, /Activation Queue/);
  }
  assert.doesNotMatch(action, /\.delete\(/);
});

test("accepted delivery preserves canonical invite-metadata warning", async () => {
  const warning = "Email accepted, but invite metadata was not persisted.";
  const result = await inviteHarness({
    delivery: {
      success: true,
      data: {
        warning,
        metadata_persisted: false,
        items: [{ queue_id: "queue-1", status: "sent" }],
      },
    },
  }).invite(input);
  assert.equal(result.emailSent, true);
  assert.equal(result.warning, warning);
});

test("canonical email sender uses the existing PIN/link and persists invited state only on accepted delivery", async () => {
  const source = readFileSync(
    "features/entry/activation/emailActions.ts",
    "utf8",
  );
  const previousKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "disposable-test-key";
  try {
    for (const fails of [false, true]) {
      const updates = [];
      const messages = [];
      const exports = load(source, {
        "next/cache": { revalidatePath() {} },
        resend: {
          Resend: class {
            emails = {
              send: async (message) => {
                messages.push(message);
                return { error: fails ? { message: "Delivery failed" } : null };
              },
            };
          },
        },
        "@/features/auth/requireSuperadmin": {
          requireSuperadmin: async () => {},
        },
        "@/features/entry/deploymentBoundary": {
          getEntryPreviewReadOnlyError: () => null,
          getResidentFacingBaseUrl: async () => "https://entry.example.test",
        },
        "@/features/entry/activation/pinActions": {
          generateActivationPins: async () => ({
            success: true,
            data: {
              items: [
                {
                  queue_id: "queue-1",
                  email: "resident@example.com",
                  activation_method: "email",
                  pin: "123456",
                  status: "pin_generated",
                  resident_name: "Resident",
                  unit_label: "10",
                },
              ],
            },
          }),
        },
        "@/lib/supabase/server": {
          createClient: async () => ({
            from: () => ({
              update: (value) => {
                updates.push(value);
                return { in: async () => ({ error: null }) };
              },
            }),
          }),
        },
      });
      const result = await exports.sendActivationEmails({
        communityId: "community-1",
        communityName: "Community",
        queueIds: ["queue-1"],
      });
      assert.equal(messages[0].from, "ENTRY <no-reply@minervatechs.com>");
      assert.match(
        messages[0].html,
        /https:\/\/entry.example.test\/activate\?pin=123456/,
      );
      assert.equal(result.data.items[0].status, fails ? "failed" : "sent");
      assert.equal(updates.length, fails ? 0 : 1);
      if (!fails) {
        assert.equal(updates[0].status, "invited");
        assert.ok(updates[0].invite_sent_at);
      }
    }
  } finally {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

test("authorization and read-only preview block preparation", async () => {
  const preview = inviteHarness({ preview: true });
  assert.equal((await preview.invite(input)).success, false);
  assert.deepEqual(preview.calls, [["authorize"]]);
  const unauthorized = inviteHarness({ unauthorized: true });
  await assert.rejects(unauthorized.invite(input), /Unauthorized/);
  assert.deepEqual(unauthorized.calls, [["authorize"]]);
});

function formHarness(options = {}) {
  const state = [];
  let cursor = 0;
  let pending;
  let busy = false;
  const calls = [];
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [
        state[index],
        (value) => {
          state[index] =
            typeof value === "function" ? value(state[index]) : value;
        },
      ];
    },
    useMemo: (compute) => compute(),
    useSyncExternalStore: () => false,
    useTransition: () => [
      busy,
      (task) => {
        busy = true;
        pending = task().finally(() => {
          busy = false;
        });
      },
    ],
  };
  const exports = load(form, {
    react,
    "next/link": {
      default: (props) => React.createElement("a", props, props.children),
    },
    "lucide-react": Object.fromEntries(
      [
        "Check",
        "ChevronDown",
        "ChevronUp",
        "Copy",
        "Eye",
        "EyeOff",
        "KeyRound",
        "Mail",
        "RefreshCw",
        "Share2",
        "UserPlus",
      ].map((name) => [name, () => null]),
    ),
    "@/features/entry/field/quickResidentActions": {
      createFieldQuickResident: async (value) => {
        calls.push(["password", value]);
        return {
          success: true,
          loginIdentity: value.username,
          residentName: value.fullName,
          unitLabel: "10",
        };
      },
    },
    "@/features/entry/field/quickResidentInviteActions": {
      inviteFieldQuickResident: async (value) => {
        calls.push(["invite", value]);
        return {
          success: true,
          emailSent: options.emailSent ?? true,
          queueId: "queue-1",
          residentName: value.fullName,
          email: value.email,
          unitLabel: "10",
        };
      },
    },
  });
  return {
    calls,
    flush: () => pending,
    render() {
      cursor = 0;
      const nodes = [];
      function visit(node) {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!React.isValidElement(node)) return;
        if (typeof node.type === "function")
          return visit(node.type(node.props));
        nodes.push(node);
        visit(node.props.children);
      }
      visit(
        exports.FieldQuickResidentForm({
          communityId: "community-1",
          communityName: "Community",
          unitId: "house-1",
          unitLabel: "10",
          isReadOnlyPreview: options.preview || false,
        }),
      );
      return nodes;
    },
  };
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (React.isValidElement(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}

function button(nodes, label) {
  return nodes.find((node) => node.type === "button" && text(node) === label);
}

test("invite form hides credentials, requires email and has no password in confirmation/success", async () => {
  const harness = formHarness();
  let nodes = harness.render();
  assert.equal(
    nodes.find((node) => node.props.id === "resident-email").props.required,
    true,
  );
  assert.equal(
    nodes.some((node) =>
      ["resident-password", "resident-username"].includes(node.props.id),
    ),
    false,
  );
  assert.equal(button(nodes, "Continue").props.disabled, true);
  nodes
    .find((node) => node.props.id === "resident-name")
    .props.onChange({ target: { value: "Resident" } });
  harness
    .render()
    .find((node) => node.props.id === "resident-email")
    .props.onChange({ target: { value: "resident@example.com" } });
  button(harness.render(), "Continue").props.onClick();
  nodes = harness.render();
  assert.equal(
    nodes.some((node) => text(node).includes("Password:")),
    false,
  );
  button(nodes, "Send invitation").props.onClick();
  assert.equal(button(harness.render(), "Preparing...").props.disabled, true);
  await harness.flush();
  nodes = harness.render();
  assert.ok(nodes.some((node) => text(node).includes("Invitation sent")));
  assert.equal(
    nodes.some(
      (node) =>
        text(node).includes("Copy credentials") ||
        node.props.type === "password",
    ),
    false,
  );
  assert.equal(harness.calls[0][0], "invite");
  assert.equal("password" in harness.calls[0][1], false);
  assert.ok(
    nodes.find(
      (node) =>
        node.props.href ===
        "/products/entry/activation?community_id=community-1",
    ),
  );
});

test("password mode retains credentials confirmation, creation and copy screen", async () => {
  const harness = formHarness();
  harness
    .render()
    .find(
      (node) => node.props.type === "radio" && node.props.value === "password",
    )
    .props.onChange();
  for (const [id, value] of [
    ["resident-name", "Resident"],
    ["resident-username", "resident10"],
    ["resident-password", "Entry!test123"],
  ]) {
    harness
      .render()
      .find((node) => node.props.id === id)
      .props.onChange({ target: { value } });
  }
  button(harness.render(), "Continue").props.onClick();
  button(harness.render(), "Create resident").props.onClick();
  await harness.flush();
  assert.equal(harness.calls[0][0], "password");
  assert.equal(harness.calls[0][1].password, "Entry!test123");
  assert.ok(button(harness.render(), "Copy credentials"));
  assert.match(immediate, /auth\.admin\.createUser/);
  assert.match(immediate, /sa_setup_user_profile/);
  assert.match(immediate, /cleanupCreatedResident/);
});

test("preview form disables invitation and mode selection", () => {
  const nodes = formHarness({ preview: true }).render();
  assert.equal(
    nodes.find((node) => node.type === "fieldset").props.disabled,
    true,
  );
  assert.equal(
    nodes.find((node) => node.props.id === "resident-email").props.disabled,
    true,
  );
  assert.equal(button(nodes, "Continue").props.disabled, true);
});
