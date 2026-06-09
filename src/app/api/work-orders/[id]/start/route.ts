import { NextRequest } from "next/server";
import { WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoStartWorkOrder } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    if (appEnv.demoMode) return ok(await demoStartWorkOrder(id));
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.IN_PROGRESS,
        updatedById: user.id,
        statusHistories: { create: { fromStatus: before.status, toStatus: WorkOrderStatus.IN_PROGRESS, changedById: user.id, reason: "작업 시작" } }
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "work_order.start", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
