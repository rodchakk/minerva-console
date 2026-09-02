"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { validateOutboundHttpUrl } from "@/features/control-center/connectionSafety";

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

export async function testProductConnectionAction(
  _previousState: TestConnectionState,
  formData: FormData,
): Promise<TestConnectionState> {
  await requireSuperadmin();

  const connectionMode = getString(formData, "connectionMode");
  const environment = getString(formData, "environment");
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

  const adminUrlSafety = await validateOutboundHttpUrl(adminUrl, {
    fieldLabel: "Admin/module URL",
  });

  if (!adminUrlSafety.ok) {
    return {
      detail: adminUrlSafety.detail,
      status: "error",
      title: adminUrlSafety.title,
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

  const overviewEndpointSafety = await validateOutboundHttpUrl(overviewEndpoint, {
    fieldLabel: "Overview endpoint",
    productionRequiresHttps: environment === "production",
  });

  if (!overviewEndpointSafety.ok) {
    return {
      detail: overviewEndpointSafety.detail,
      status: "error",
      title: overviewEndpointSafety.title,
    };
  }

  try {
    const response = await fetch(overviewEndpointSafety.url.href, {
      cache: "no-store",
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });

    if (response.status >= 300 && response.status < 400) {
      return {
        detail:
          "The endpoint returned a redirect. Redirects are rejected in Phase 1 so they cannot bypass destination validation.",
        status: "error",
        title: "Overview endpoint redirected",
      };
    }

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
