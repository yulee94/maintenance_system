import { NextRequest } from "next/server";
import { WorkOrderStatus } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { demoStartWorkOrder } from "@/lib/demo";
import { appEnv } from "@/lib/env";
import { canAccessMobileTask, mobileTasksForUser, toMobileTask } from "@/lib/mobile-api";
import { workOrderInclude } from "@/lib/work-orders";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;

    if (appEnv.demoMode) {
      const visibleTask = (await mobileTasksForUser(user)).find((task) => task.id === id);
      if (!visibleTask) throw new ApiError(403, "이 정비건을 처리할 권한이 없습니다.");
      return ok(toMobileTask(await demoStartWorkOrder(id)));
    }

    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before || before.archivedAt || before.deletedAt) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    if (!canAccessMobileTask(user, before.assignedMechanicId)) {
      throw new ApiError(403, "이 정비건을 처리할 권한이 없습니다.");
    }

    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.IN_PROGRESS,
        updatedById: user.id,
        statusHistories: {
          create: {
            fromStatus: before.status,
            toStatus: WorkOrderStatus.IN_PROGRESS,
            changedById: user.id,
            reason: "모바일 앱 작업 시작"
          }
        }
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "mobile.task.start", targetType: "workOrder", targetId: id, before, after: row });
    return ok(toMobileTask(row));
  } catch (error) {
    return handleApiError(error);
  }
}
