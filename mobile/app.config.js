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
      bundleIdentifier: profile.iosBundleIdentifier,
      infoPlist: {
        ...(baseConfig.ios?.infoPlist || {}),
        NSCameraUsageDescription:
          "정비 완료보고에서 장비 상태, 고장 부위, 교체 부품 사진을 촬영하기 위해 카메라 접근이 필요합니다.",
        NSPhotoLibraryUsageDescription:
          "정비 완료보고에 기존 현장 사진 또는 동영상을 첨부하기 위해 사진 보관함 접근이 필요합니다.",
        NSPhotoLibraryAddUsageDescription:
          "정비 보고용으로 촬영한 사진을 기기에 저장하도록 허용할 때 사용합니다."
      }
    },
    android: {
      ...baseConfig.android,
      package: profile.androidPackage,
      blockedPermissions: [
        ...(baseConfig.android?.blockedPermissions || []),
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.READ_PHONE_STATE",
        "android.permission.RECORD_AUDIO"
      ]
    },
    extra: {
      ...(baseConfig.extra || {}),
      appEnv,
      apiBaseUrl: apiUrls[appEnv],
      apiUrls,
      review: {
        privacyPolicyUrl: process.env.APP_PRIVACY_POLICY_URL || "https://maintenance.example.co.kr/privacy",
        supportUrl: process.env.APP_SUPPORT_URL || "https://maintenance.example.co.kr/support",
        reviewNotesUrl: process.env.APP_REVIEW_NOTES_URL || "https://maintenance.example.co.kr/app-review"
      },
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
