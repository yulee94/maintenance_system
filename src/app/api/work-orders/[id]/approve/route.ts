import { NextRequest } from "next/server";
import { RoleCode, WorkOrderStatus, WorkResultType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { workOrderInclude } from "@/lib/work-orders";

const schema = z.object({
  memo: z.string().optional(),
  kpiExcluded: z.boolean().optional(),
  kpiExclusionReason: z.string().optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const finalCompleted = before.resultType === WorkResultType.COMPLETED;
    const nextStatus = finalCompleted ? WorkOrderStatus.FINAL_COMPLETED : WorkOrderStatus.TEMPORARY_ACTION;
    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        status: nextStatus,
        adminApprovedAt: new Date(),
        finalCompletedAt: finalCompleted ? new Date() : null,
        kpiExcluded: input.kpiExcluded ?? before.kpiExcluded,
        kpiExclusionReason: input.kpiExclusionReason ?? before.kpiExclusionReason,
        updatedById: user.id,
        statusHistories: { create: { fromStatus: before.status, toStatus: nextStatus, changedById: user.id, reason: input.memo ?? "관리자 승인" } },
        kpiExclusions:
          input.kpiExcluded && input.kpiExclusionReason
            ? { create: { reason: input.kpiExclusionReason, createdById: user.id } }
            : undefined
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "work_order.approve", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
