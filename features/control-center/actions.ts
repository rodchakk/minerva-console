"use server";

export type TestConnectionState = {
  detail: string;
  status: "idle" | "success" | "error";
  title: string;
};

const VALID_OVERVIEW_STATUSES = new Set([
  "operational",
  "development",
  "disconnected",
  "error",
]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  const ipv4PrivatePattern =
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

  return (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    ipv4PrivatePattern.test(host)
  );
}

export async function testProductConnectionAction(
  _previousState: TestConnectionState,
  formData: FormData,
): Promise<TestConnectionState> {
  const connectionMode = getString(formData, "connectionMode");
  const adminUrl = getString(formData, "adminUrl");
  const overviewEndpoint = getString(formData, "overviewEndpoint");

  if (connectionMode === "native_module") {
    return {
      detail:
        "Native modules are validated through Console routing and server-side authorization. No connector request is needed.",
      status: "success",
      title: "Native module route accepted",
    };
  }

  const parsedAdminUrl = parseHttpUrl(adminUrl);

  if (!adminUrl || !parsedAdminUrl) {
    return {
      detail: "Enter a valid http or https Admin/module URL before testing.",
      status: "error",
      title: "Admin URL needs attention",
    };
  }

  if (isBlockedHost(parsedAdminUrl.hostname)) {
    return {
      detail:
        "Local, link-local, and private network hosts are not allowed for external product connection tests.",
      status: "error",
      title: "Admin URL host is not allowed",
    };
  }

  if (connectionMode === "link_only") {
    return {
      detail:
        "The link-only configuration is structurally valid. No network request or credential is required for this mode.",
      status: "success",
      title: "Link-only connection ready",
    };
  }

  if (connectionMode !== "overview_api") {
    return {
      detail: "Full integration remains a future mode and is not testable in Phase 1.",
      status: "error",
      title: "Connection mode is not supported yet",
    };
  }

  const parsedOverviewEndpoint = parseHttpUrl(overviewEndpoint);

  if (!overviewEndpoint || !parsedOverviewEndpoint) {
    return {
      detail: "Enter a valid http or https overview endpoint for Overview API mode.",
      status: "error",
      title: "Overview endpoint needs attention",
    };
  }

  if (isBlockedHost(parsedOverviewEndpoint.hostname)) {
    return {
      detail:
        "Local, link-local, and private network hosts are not allowed for Overview API tests.",
      status: "error",
      title: "Overview endpoint host is not allowed",
    };
  }

  try {
    const response = await fetch(overviewEndpoint, {
      cache: "no-store",
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return {
        detail: `The endpoint returned HTTP ${response.status}. Verify the endpoint is reachable and read-only.`,
        status: "error",
        title: "Overview endpoint rejected the request",
      };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const status = typeof payload.status === "string" ? payload.status : "";

    if (!VALID_OVERVIEW_STATUSES.has(status)) {
      return {
        detail:
          "The response must include status as operational, development, disconnected, or error.",
        status: "error",
        title: "Overview response shape is invalid",
      };
    }

    return {
      detail:
        "Read-only overview endpoint responded with the expected V1 status contract. Product data was not written anywhere or sent to Brain.",
      status: "success",
      title: "Overview connection successful",
    };
  } catch {
    return {
      detail:
        "The overview endpoint could not be reached within the test window. Check the URL, auth policy, and response format.",
      status: "error",
      title: "Overview endpoint unavailable",
    };
  }
}
