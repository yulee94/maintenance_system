import { ok } from "@/lib/api";

export async function GET() {
  return ok({
    apiGroup: "Public Customer API",
    apiVersion: "v1",
    status: "ok",
    serverTime: new Date().toISOString()
  });
}
