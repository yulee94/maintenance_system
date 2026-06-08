import { mkdir, cp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = process.env.BACKUP_ROOT ?? "./storage/backups";
const uploadRoot = process.env.UPLOAD_ROOT ?? "./storage/uploads";
const databaseUrl = process.env.DATABASE_URL;
const outputDir = path.join(backupRoot, timestamp);

await mkdir(outputDir, { recursive: true });

if (databaseUrl) {
  const dumpFile = path.join(outputDir, "database.dump");
  const result = spawnSync("pg_dump", ["--format=custom", "--file", dumpFile, databaseUrl], {
    stdio: "inherit",
    shell: true
  });
  if (result.status !== 0) {
    console.warn("pg_dump failed. Install PostgreSQL client tools or run backup inside a container with pg_dump.");
  }
} else {
  console.warn("DATABASE_URL is not set. Skipping database dump.");
}

await cp(uploadRoot, path.join(outputDir, "uploads"), { recursive: true, force: true }).catch(() => {
  console.warn("No upload directory found. Skipping upload copy.");
});

console.log(`Backup completed: ${outputDir}`);
