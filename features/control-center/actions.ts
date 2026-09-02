"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  validateConfiguredHttpUrl,
  validateNativeModulePath,
} from "@/features/control-center/connectionSafety";

export type TestConnectionState = {
  detail: string;
  status: "idle" | "success" | "error";
  title: string;
};

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
    const nativeRouteSafety = validateNativeModulePath(adminUrl);

    if (!nativeRouteSafety.ok) {
      return {
        detail: nativeRouteSafety.detail,
        status: "error",
        title: nativeRouteSafety.title,
      };
    }

    return {
      detail:
        "Native modules are validated through Console routing and server-side authorization. No connector request is needed.",
      status: "success",
      title: "Native module route accepted",
    };
  }

  const adminUrlSafety = validateConfiguredHttpUrl(adminUrl, {
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
        "The link-only configuration is valid. No network request or credential is required for this mode.",
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

  const overviewEndpointSafety = validateConfiguredHttpUrl(overviewEndpoint, {
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

  return {
    detail:
      "Configuration valid. Live endpoint verification is deferred until the external Overview API integration mission.",
    status: "success",
    title: "Overview API configuration ready",
  };
}
