import { appEnv } from "@/lib/env";

export type MobilePlatform = "ios" | "android" | "web" | "unknown";

export type MobileVersionPolicyInput = {
  currentVersion?: string | null;
  platform?: string | null;
};

export function resolveMobileVersionPolicy(input: MobileVersionPolicyInput = {}) {
  const currentVersion = normalizeVersion(input.currentVersion);
  const minimumSupportedVersion = normalizeVersion(appEnv.mobileMinimumSupportedVersion);
  const latestVersion = normalizeVersion(appEnv.mobileLatestVersion);
  const platform = normalizePlatform(input.platform);
  const isBelowMinimum = compareVersions(currentVersion, minimumSupportedVersion) < 0;
  const hasUpdate = compareVersions(currentVersion, latestVersion) < 0;
  const forceUpdateRequired = appEnv.mobileForceUpdateRequired || isBelowMinimum;

  return {
    minimum_supported_version: minimumSupportedVersion,
    latest_version: latestVersion,
    current_version: currentVersion,
    force_update_required: forceUpdateRequired,
    maintenance_mode: appEnv.mobileMaintenanceMode,
    notice_message: appEnv.mobileMaintenanceMode
      ? appEnv.mobileNoticeMessage || "현재 서버 점검 중입니다. 잠시 후 다시 시도해 주세요."
      : forceUpdateRequired
        ? `현재 앱 버전 ${currentVersion}은 더 이상 지원되지 않습니다. ${minimumSupportedVersion} 이상으로 업데이트해 주세요.`
        : hasUpdate
          ? appEnv.mobileNoticeMessage
          : "",
    update_available: hasUpdate,
    checked_at: new Date().toISOString(),
    store_urls: {
      ios: appEnv.mobileIosStoreUrl,
      android: appEnv.mobileAndroidStoreUrl
    },
    platform
  };
}

export function compareVersions(left: string, right: string) {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

function parseVersionParts(value: string) {
  return normalizeVersion(value)
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function normalizeVersion(value: string | null | undefined) {
  const normalized = value?.trim().replace(/^v/i, "").split(/[+-]/)[0] ?? "";
  return /^\d+(\.\d+){0,3}$/.test(normalized) ? normalized : "0.0.0";
}

function normalizePlatform(value: string | null | undefined): MobilePlatform {
  if (value === "ios" || value === "android" || value === "web") return value;
  return "unknown";
}
