import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, created, handleApiError, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoRequestDailyPlan } from "@/lib/demo";

const itemSchema = z.object({
  workOrderId: z.string().min(1),
  mechanicId: z.string().nullish(),
  adminMemo: z.string().optional(),
  mechanicMemo: z.string().optional()
});

const schema = z.object({
  planDate: z.string().min(1),
  workOrderIds: z.array(z.string()).min(1),
  itemDetails: z.array(itemSchema).optional()
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN, RoleCode.MECHANIC]);
    const input = await readJson(request, schema);
    const planDate = parseDateInput(input.planDate);
    if (!planDate) throw new ApiError(422, "계획일자가 올바르지 않습니다.");
    if (appEnv.demoMode) return created(await demoRequestDailyPlan(input, user));

    const workOrders = await prisma.workOrder.findMany({
      where: { id: { in: input.workOrderIds }, deletedAt: null, archivedAt: null },
      select: { id: true, assignedMechanicId: true }
    });
    if (workOrders.length !== input.workOrderIds.length) {
      throw new ApiError(422, "선택한 정비건 중 확인할 수 없는 건이 있습니다.");
    }

    const detailByWorkOrder = new Map((input.itemDetails ?? []).map((item) => [item.workOrderId, item]));
    const row = await prisma.dailyWorkPlan.create({
      data: {
        planDate,
        requestedById: user.id,
        items: {
          create: input.workOrderIds.map((workOrderId, index) => {
            const detail = detailByWorkOrder.get(workOrderId);
            const workOrder = workOrders.find((item) => item.id === workOrderId);
            return {
              workOrderId,
              mechanicId: detail?.mechanicId ?? workOrder?.assignedMechanicId ?? (user.roles.includes(RoleCode.MECHANIC) ? user.id : undefined),
              orderIndex: index + 1,
              adminMemo: detail?.adminMemo,
              mechanicMemo: detail?.mechanicMemo
            };
          })
        }
      },
      include: { items: true, requestedBy: { select: { id: true, name: true, title: true } } }
    });

    const adminRecipients = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { code: { in: [RoleCode.SUPER_ADMIN, RoleCode.ADMIN] } } } }
      },
      select: { id: true }
    });
    await prisma.notification.createMany({
      data: adminRecipients.map((recipient) => ({
        userId: recipient.id,
        type: "DAILY_PLAN_REQUESTED",
        title: "계획업무 승인 요청",
        body: `${user.name}님이 ${input.workOrderIds.length}건의 계획업무 검토를 요청했습니다.`
      }))
    });

    await auditLog({ user, request, action: "daily_plan.request", targetType: "dailyWorkPlan", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
