import { NextRequest } from "next/server";
import { DailyPlanStatus, RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoUpdateDailyPlan } from "@/lib/demo";

const itemSchema = z.object({
  workOrderId: z.string().min(1),
  mechanicId: z.string().nullish(),
  adminMemo: z.string().optional(),
  mechanicMemo: z.string().optional()
});

const schema = z.object({
  planDate: z.string().optional(),
  reviewMemo: z.string().optional(),
  itemDetails: z.array(itemSchema).optional()
});

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

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN, RoleCode.MECHANIC]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    if (appEnv.demoMode) return ok(await demoUpdateDailyPlan(id, input, user));

    const before = await prisma.dailyWorkPlan.findUnique({ where: { id }, include: { items: true } });
    if (!before) throw new ApiError(404, "계획업무를 찾을 수 없습니다.");
    if (before.status === DailyPlanStatus.FINAL_CONFIRMED) throw new ApiError(409, "최종확정된 계획업무는 수정할 수 없습니다.");

    const isAdmin = user.roles.includes(RoleCode.SUPER_ADMIN) || user.roles.includes(RoleCode.ADMIN);
    const isPlanMechanic = before.requestedById === user.id || before.items.some((item) => item.mechanicId === user.id);
    if (!isAdmin && !isPlanMechanic) throw new ApiError(403, "이 계획업무를 수정할 권한이 없습니다.");

    const existingItemByWorkOrder = new Map(before.items.map((item) => [item.workOrderId, item]));
    const requestedItems = input.itemDetails;
    const row = await prisma.$transaction(async (tx) => {
      if (requestedItems?.length) {
        const workOrders = await tx.workOrder.findMany({
          where: { id: { in: requestedItems.map((item) => item.workOrderId) }, deletedAt: null, archivedAt: null },
          select: { id: true, assignedMechanicId: true }
        });
        if (workOrders.length !== requestedItems.length) throw new ApiError(422, "선택한 정비건 중 확인할 수 없는 건이 있습니다.");
        await tx.dailyWorkPlanItem.deleteMany({ where: { planId: id } });
        await tx.dailyWorkPlanItem.createMany({
          data: requestedItems.map((item, index) => {
            const existing = existingItemByWorkOrder.get(item.workOrderId);
            const workOrder = workOrders.find((row) => row.id === item.workOrderId);
            return {
              planId: id,
              workOrderId: item.workOrderId,
              mechanicId: isAdmin ? item.mechanicId ?? workOrder?.assignedMechanicId : existing?.mechanicId ?? user.id,
              orderIndex: index + 1,
              adminMemo: isAdmin ? item.adminMemo : existing?.adminMemo,
              mechanicMemo: item.mechanicMemo ?? existing?.mechanicMemo
            };
          })
        });
      }

      await tx.dailyWorkPlan.update({
        where: { id },
        data: {
          planDate: parseDateInput(input.planDate),
          reviewMemo: input.reviewMemo,
          status: DailyPlanStatus.REQUESTED,
          reviewedById: null,
          reviewedAt: null
        }
      });
      return tx.dailyWorkPlan.findUniqueOrThrow({ where: { id }, include: planInclude });
    });

    const recipients = isAdmin
      ? Array.from(new Set(row.items.map((item) => item.mechanicId).filter(Boolean) as string[]))
      : (
          await prisma.user.findMany({
            where: {
              isActive: true,
              roles: { some: { role: { code: { in: [RoleCode.SUPER_ADMIN, RoleCode.ADMIN] } } } }
            },
            select: { id: true }
          })
        ).map((recipient) => recipient.id);
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((recipientId) => ({
          userId: recipientId,
          type: isAdmin ? "DAILY_PLAN_REVIEWED" : "DAILY_PLAN_REQUESTED",
          title: isAdmin ? "계획업무 수정 알림" : "계획업무 수정 검토 요청",
          body: isAdmin
            ? `${user.name}님이 계획 세부업무를 수정했습니다. 변경사항을 확인하세요.`
            : `${user.name}님이 계획업무를 수정했습니다. 관리자 검토가 필요합니다.`
        }))
      });
    }

    await auditLog({ user, request, action: "daily_plan.update", targetType: "dailyWorkPlan", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
