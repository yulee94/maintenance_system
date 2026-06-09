import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.SUPER_ADMIN]);
    return ok({
      apiGroup: "Internal Admin API",
      apiVersion: "v1",
      status: "ok",
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
