import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoAuditLogs } from "@/lib/demo";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN]);
    if (appEnv.demoMode) return ok(await demoAuditLogs());
    const rows = await prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true, loginId: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
