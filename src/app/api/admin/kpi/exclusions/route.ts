import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { created, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  workOrderId: z.string().min(1),
  reason: z.string().min(1),
  detail: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    const rows = await prisma.kpiExclusion.findMany({
      include: {
        workOrder: { include: { customer: true, site: true } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    const input = await readJson(request, schema);
    const row = await prisma.kpiExclusion.create({
      data: { workOrderId: input.workOrderId, reason: input.reason, detail: input.detail, createdById: user.id }
    });
    await prisma.workOrder.update({
      where: { id: input.workOrderId },
      data: { kpiExcluded: true, kpiExclusionReason: input.reason }
    });
    await auditLog({ user, request, action: "kpi.exclusion.create", targetType: "kpiExclusion", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
