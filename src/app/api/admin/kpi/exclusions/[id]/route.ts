import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    const { id } = await context.params;
    const before = await prisma.kpiExclusion.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "KPI 제외 항목을 찾을 수 없습니다.");
    const row = await prisma.kpiExclusion.update({ where: { id }, data: { revokedAt: new Date() } });
    if (before.workOrderId) {
      await prisma.workOrder.update({
        where: { id: before.workOrderId },
        data: { kpiExcluded: false, kpiExclusionReason: null }
      });
    }
    await auditLog({ user, request, action: "kpi.exclusion.revoke", targetType: "kpiExclusion", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
