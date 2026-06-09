export const appEnv = {
  demoMode: process.env.DEMO_MODE === "true",
  jwtSecret: process.env.JWT_SECRET ?? "development-only-maintenance-secret-change-me",
  uploadRoot: process.env.UPLOAD_ROOT ?? "./storage/uploads",
  backupRoot: process.env.BACKUP_ROOT ?? "./storage/backups",
  excelTemplateRoot: process.env.EXCEL_TEMPLATE_ROOT ?? "./docs/templates",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  mobileMfaRequired: process.env.MOBILE_MFA_REQUIRED === "true",
  mobileTestOtpCode: process.env.MOBILE_TEST_OTP_CODE ?? "000000",
  mobileDeviceRegistrationRequired: process.env.MOBILE_DEVICE_REGISTRATION_REQUIRED !== "false",
  fcmServerKey: process.env.FCM_SERVER_KEY,
  apnsKeyId: process.env.APNS_KEY_ID,
  apnsTeamId: process.env.APNS_TEAM_ID,
  apnsBundleId: process.env.APNS_BUNDLE_ID,
  apnsPrivateKey: process.env.APNS_PRIVATE_KEY,
  apnsUseSandbox: process.env.APNS_USE_SANDBOX === "true",
  mobileMinimumSupportedVersion: process.env.MOBILE_MINIMUM_SUPPORTED_VERSION ?? "0.1.0",
  mobileLatestVersion: process.env.MOBILE_LATEST_VERSION ?? "0.1.0",
  mobileForceUpdateRequired: process.env.MOBILE_FORCE_UPDATE_REQUIRED === "true",
  mobileMaintenanceMode: process.env.MOBILE_MAINTENANCE_MODE === "true",
  mobileNoticeMessage:
    process.env.MOBILE_NOTICE_MESSAGE ??
    "정비 운영 앱을 안정적으로 이용하기 위해 최신 버전 사용을 권장합니다.",
  mobileIosStoreUrl: process.env.MOBILE_IOS_STORE_URL ?? "https://apps.apple.com/app/id0000000000",
  mobileAndroidStoreUrl: process.env.MOBILE_ANDROID_STORE_URL ?? "https://play.google.com/store/apps/details?id=com.bitween.maintenance"
};
