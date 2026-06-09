import Constants from "expo-constants";

type AppEnv = "dev" | "staging" | "prod";

type RuntimeExtra = {
  appEnv?: AppEnv;
  apiBaseUrl?: string;
  apiUrls?: Partial<Record<AppEnv, string>>;
  crashReporting?: {
    provider?: string;
    sentryDsn?: string;
    firebaseCrashlyticsEnabled?: boolean;
  };
  analytics?: {
    provider?: string;
    amplitudeApiKey?: string;
  };
  remoteConfig?: {
    provider?: string;
    url?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as RuntimeExtra;

export function getAppEnvironment(): AppEnv {
  return extra.appEnv ?? "dev";
}

export function getApiBaseUrl() {
  const env = getAppEnvironment();
  const url = extra.apiBaseUrl ?? extra.apiUrls?.[env] ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function getRuntimeConfig() {
  return {
    appEnv: getAppEnvironment(),
    apiBaseUrl: getApiBaseUrl(),
    crashReporting: extra.crashReporting ?? {},
    analytics: extra.analytics ?? {},
    remoteConfig: extra.remoteConfig ?? {}
  };
}
