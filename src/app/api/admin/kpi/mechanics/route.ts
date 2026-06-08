import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { getMechanicKpi } from "@/lib/kpi";
import { appEnv } from "@/lib/env";
import { demoMechanicKpi } from "@/lib/demo";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    if (appEnv.demoMode) return ok(demoMechanicKpi());
    return ok(await getMechanicKpi());
  } catch (error) {
    return handleApiError(error);
  }
}
