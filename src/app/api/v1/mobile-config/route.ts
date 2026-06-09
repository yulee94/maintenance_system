import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { resolveMobileVersionPolicy } from "@/lib/mobile-version-policy";

export async function GET(request: NextRequest) {
  const appVersion = request.nextUrl.searchParams.get("app_version");
  const platform = request.nextUrl.searchParams.get("platform");

  return ok({
    apiVersion: "v1",
    version_policy: resolveMobileVersionPolicy({
      currentVersion: appVersion,
      platform
    })
  });
}
