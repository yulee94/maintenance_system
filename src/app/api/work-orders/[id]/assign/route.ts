import { NextRequest } from "next/server";
import { RoleCode, WorkOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoAssignWorkOrder } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

const schema = z.object({
  assignedMechanicId: z.string().min(1),
  reason: z.string().optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    if (appEnv.demoMode) {
      const row = await demoAssignWorkOrder(id, input.assignedMechanicId);
      if (!row) throw new ApiError(404, "정비사를 찾을 수 없습니다.");
      return ok(row);
    }
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        assignedMechanicId: input.assignedMechanicId,
        status: before.status === WorkOrderStatus.RECEIVED || before.status === WorkOrderStatus.UNASSIGNED ? WorkOrderStatus.ASSIGNED : before.status,
        updatedById: user.id,
        assignmentHistories: {
          create: {
            assignedMechanicId: input.assignedMechanicId,
            changedById: user.id,
            reason: input.reason ?? "관리자 배정"
          }
        }
      },
      include: workOrderInclude
    });
    await prisma.notification.create({
      data: {
        userId: input.assignedMechanicId,
        workOrderId: id,
        type: "ASSIGNED",
        title: "정비건 배정",
        body: `${row.requestNo} 정비건이 배정되었습니다.`
      }
    });
    await auditLog({ user, request, action: "work_order.assign", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
