import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { appEnv } from "@/lib/env";
import { mediaTypeForMime } from "@/lib/work-orders";

const allowedMimePrefixes = ["image/", "video/"];
const allowedMimeExact = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
];

export function assertAllowedUpload(mimeType: string, size: number) {
  const allowed =
    allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix)) || allowedMimeExact.includes(mimeType);
  if (!allowed) {
    throw new Error("Unsupported file type.");
  }
  if (size > 50 * 1024 * 1024) {
    throw new Error("File size must be 50MB or less.");
  }
}

export async function saveFormFile(file: File, folder: string) {
  assertAllowedUpload(file.type, file.size);
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, "_");
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const dir = path.join(appEnv.uploadRoot, folder);
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, fileName);
  await writeFile(storagePath, bytes);
  return {
    fileName,
    originalName: file.name,
    mimeType: file.type,
    mediaType: mediaTypeForMime(file.type),
    sizeBytes: file.size,
    storagePath,
    publicPath: `/api/files/${encodeURIComponent(fileName)}`
  };
}
