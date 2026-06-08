export const appEnv = {
  demoMode: process.env.DEMO_MODE === "true",
  jwtSecret: process.env.JWT_SECRET ?? "development-only-maintenance-secret-change-me",
  uploadRoot: process.env.UPLOAD_ROOT ?? "./storage/uploads",
  backupRoot: process.env.BACKUP_ROOT ?? "./storage/backups",
  excelTemplateRoot: process.env.EXCEL_TEMPLATE_ROOT ?? "./docs/templates",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
};
