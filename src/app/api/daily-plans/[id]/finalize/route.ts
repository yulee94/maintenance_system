import { NextRequest } from "next/server";
import { DailyPlanStatus, RoleCode, WorkOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoFinalizeDailyPlan } from "@/lib/demo";

const schema = z.object({ memo: z.string().optional() });

const planInclude = {
  requestedBy: { select: { id: true, name: true, title: true } },
  reviewedBy: { select: { id: true, name: true, title: true } },
  items: {
    include: {
      mechanic: { select: { id: true, name: true, title: true } },
      workOrder: {
        include: {
          customer: true,
          site: true,
          equipment: true,
          assignedMechanic: { select: { id: true, name: true, title: true, phone: true } }
        }
      }
    },
    orderBy: { orderIndex: "asc" as const }
  }
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema).catch(() => ({ memo: undefined }));
    if (appEnv.demoMode) return ok(await demoFinalizeDailyPlan(id, user, input.memo));

    const before = await prisma.dailyWorkPlan.findUnique({ where: { id }, include: { items: true } });
    if (!before) throw new ApiError(404, "계획업무를 찾을 수 없습니다.");
    if (before.status === DailyPlanStatus.FINAL_CONFIRMED) throw new ApiError(409, "이미 최종확정된 계획업무입니다.");

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.dailyWorkPlan.update({
        where: { id },
        data: {
          status: DailyPlanStatus.FINAL_CONFIRMED,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewMemo: input.memo ?? before.reviewMemo ?? "관리자 최종확정"
        },
        include: { items: true }
      });
      for (const item of updated.items) {
        const workOrder = await tx.workOrder.findUnique({ where: { id: item.workOrderId }, select: { status: true } });
        const assignableStatuses: WorkOrderStatus[] = [WorkOrderStatus.RECEIVED, WorkOrderStatus.UNASSIGNED];
        const nextStatus = workOrder && assignableStatuses.includes(workOrder.status)
          ? WorkOrderStatus.ASSIGNED
          : workOrder?.status;
        await tx.workOrder.update({
          where: { id: item.workOrderId },
          data: {
            targetDueDate: updated.planDate,
            assignedMechanicId: item.mechanicId ?? undefined,
            status: nextStatus,
            updatedById: user.id,
            statusHistories: nextStatus && nextStatus !== workOrder?.status
              ? { create: { toStatus: nextStatus, reason: "계획업무 최종확정", changedById: user.id } }
              : undefined
          }
        });
      }
      return tx.dailyWorkPlan.findUniqueOrThrow({ where: { id }, include: planInclude });
    });

    const recipients = Array.from(new Set(row.items.map((item) => item.mechanicId).filter(Boolean) as string[]));
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((recipientId) => ({
          userId: recipientId,
          type: "DAILY_PLAN_REVIEWED",
          title: "계획업무 최종확정",
          body: `${user.name}님이 ${row.items.length}건의 계획업무를 최종확정했습니다. 추가 수정은 제한됩니다.`
        }))
      });
    }

    await auditLog({ user, request, action: "daily_plan.final_confirm", targetType: "dailyWorkPlan", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
