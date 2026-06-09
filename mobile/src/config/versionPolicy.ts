import Constants from "expo-constants";
import { Platform } from "react-native";
import { getApiBaseUrl, getAppEnvironment, getRuntimeConfig } from "./environment";

export type VersionPolicy = {
  minimum_supported_version: string;
  latest_version: string;
  current_version: string;
  force_update_required: boolean;
  maintenance_mode: boolean;
  notice_message: string;
  update_available: boolean;
  checked_at: string;
  platform: "ios" | "android" | "web" | "unknown";
  store_urls: {
    ios?: string;
    android?: string;
  };
};

type VersionPolicyEnvelope = {
  ok: boolean;
  data?: {
    apiVersion: string;
    version_policy: VersionPolicy;
  };
  error?: string;
};

export function getCurrentAppVersion() {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.0.0";
}

export async function fetchVersionPolicy() {
  const config = getRuntimeConfig();
  const endpoint = config.remoteConfig.url || `${getApiBaseUrl()}/api/v1/mobile-config`;
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${endpoint}${separator}${toQueryString({
    app_version: getCurrentAppVersion(),
    platform: Platform.OS,
    app_env: getAppEnvironment()
  })}`;

  const response = await fetch(url, {
    headers: {
      "X-Client-Platform": "mobile",
      "X-App-Version": getCurrentAppVersion()
    }
  });
  const body = (await response.json()) as VersionPolicyEnvelope;

  if (!response.ok || !body.ok || !body.data?.version_policy) {
    throw new Error(body.error ?? "버전 정책을 확인하지 못했습니다.");
  }

  return body.data.version_policy;
}

function toQueryString(input: Record<string, string>) {
  return Object.entries(input)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}
