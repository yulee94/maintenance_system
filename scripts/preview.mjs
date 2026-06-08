import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

const args = process.argv.slice(2);
const skipBuild = args.includes("--no-build");
const portArg = args.find((arg) => arg.startsWith("--port="));
const port = process.env.PORT ?? portArg?.split("=")[1] ?? "3000";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://maintenance:maintenance@localhost:5432/maintenance_system?schema=public",
  DEMO_MODE: process.env.DEMO_MODE ?? "true",
  JWT_SECRET:
    process.env.JWT_SECRET ??
    "local-preview-maintenance-secret-change-before-production",
  APP_BASE_URL: process.env.APP_BASE_URL ?? `http://localhost:${port}`,
  UPLOAD_ROOT: process.env.UPLOAD_ROOT ?? "./storage/uploads",
  BACKUP_ROOT: process.env.BACKUP_ROOT ?? "./storage/backups",
  EXCEL_TEMPLATE_ROOT: process.env.EXCEL_TEMPLATE_ROOT ?? "./docs/templates",
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1"
};

function localNetworkUrls() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${port}`);
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const spawnCommand = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : command;
    const spawnArgs = process.platform === "win32" ? ["/d", "/s", "/c", command, ...commandArgs] : commandArgs;
    const child = spawn(spawnCommand, spawnArgs, {
      env,
      stdio: "inherit",
      shell: false
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${commandArgs.join(" ")} failed with exit code ${code}`));
    });
  });
}

function printPreviewInfo() {
  const urls = [`http://localhost:${port}`, ...localNetworkUrls()];
  console.log("");
  console.log("Maintenance system preview is running in DEMO_MODE=true.");
  console.log("Preview URLs:");
  for (const url of urls) console.log(`- ${url}`);
  console.log("");
  console.log("Demo accounts:");
  console.log("- 최고관리자: ko.ms / Admin!2026Test");
  console.log("- 임원:       kim.ms / Exec!2026Test");
  console.log("- 관리자:     son.hn / Admin2!2026Test");
  console.log("- 정비사:     jegal.ts / Mech!2026Test");
  console.log("- 접수자:     park.jw / Reception!2026");
  console.log("");
  console.log("Use Ctrl+C to stop the preview server.");
  console.log("");
}

if (!skipBuild) {
  await run(npmCommand, ["run", "build"]);
}

printPreviewInfo();
await run(npmCommand, ["run", "start", "--", "-H", "0.0.0.0", "-p", port]);
