import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { getPriorityKpi } from "@/lib/kpi";
import { appEnv } from "@/lib/env";
import { demoPriorityKpi } from "@/lib/demo";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    if (appEnv.demoMode) return ok(await demoPriorityKpi());
    return ok(await getPriorityKpi());
  } catch (error) {
    return handleApiError(error);
  }
}
