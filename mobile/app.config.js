const staticConfig = require("./app.json").expo;

module.exports = ({ config } = {}) => {
  const baseConfig = config || staticConfig;
  const appEnv = normalizeEnv(process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || "dev");

  const apiUrls = {
    dev: process.env.DEV_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000",
    staging: process.env.STAGING_API_URL || "https://api-staging-maintenance.example.co.kr",
    prod: process.env.PROD_API_URL || "https://api-maintenance.example.co.kr"
  };

  const appProfiles = {
    dev: {
      name: "정비 운영 Dev",
      slug: "maintenance-system-mobile-dev",
      scheme: "maintenance-dev",
      iosBundleIdentifier: "com.bitween.maintenance.dev",
      androidPackage: "com.bitween.maintenance.dev"
    },
    staging: {
      name: "정비 운영 Staging",
      slug: "maintenance-system-mobile-staging",
      scheme: "maintenance-staging",
      iosBundleIdentifier: "com.bitween.maintenance.staging",
      androidPackage: "com.bitween.maintenance.staging"
    },
    prod: {
      name: "정비 운영",
      slug: "maintenance-system-mobile",
      scheme: "maintenance",
      iosBundleIdentifier: "com.bitween.maintenance",
      androidPackage: "com.bitween.maintenance"
    }
  };

  const profile = appProfiles[appEnv];

  return {
    ...baseConfig,
    name: profile.name,
    slug: profile.slug,
    scheme: profile.scheme,
    ios: {
      ...baseConfig.ios,
      bundleIdentifier: profile.iosBundleIdentifier
    },
    android: {
      ...baseConfig.android,
      package: profile.androidPackage
    },
    extra: {
      ...(baseConfig.extra || {}),
      appEnv,
      apiBaseUrl: apiUrls[appEnv],
      apiUrls,
      crashReporting: {
        provider: process.env.CRASH_REPORTING_PROVIDER || "sentry",
        sentryDsn: process.env.SENTRY_DSN || "",
        firebaseCrashlyticsEnabled: process.env.FIREBASE_CRASHLYTICS_ENABLED === "true"
      },
      analytics: {
        provider: process.env.ANALYTICS_PROVIDER || "firebase",
        amplitudeApiKey: process.env.AMPLITUDE_API_KEY || ""
      },
      remoteConfig: {
        provider: process.env.REMOTE_CONFIG_PROVIDER || "api",
        url: process.env.REMOTE_CONFIG_URL || `${apiUrls[appEnv]}/api/v1/mobile-config`
      }
    }
  };
};

function normalizeEnv(value) {
  if (value === "production") return "prod";
  if (value === "preview") return "staging";
  if (["dev", "staging", "prod"].includes(value)) return value;
  return "dev";
}
