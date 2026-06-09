import { NextRequest } from "next/server";
import { DailyPlanStatus, RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoRejectDailyPlan } from "@/lib/demo";

const schema = z.object({ memo: z.string().min(1) });

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
    const input = await readJson(request, schema);
    if (appEnv.demoMode) return ok(await demoRejectDailyPlan(id, user, input.memo));

    const before = await prisma.dailyWorkPlan.findUnique({ where: { id }, include: { items: true } });
    if (!before) throw new ApiError(404, "계획업무를 찾을 수 없습니다.");
    if (before.status === DailyPlanStatus.FINAL_CONFIRMED) throw new ApiError(409, "최종확정된 계획업무는 반려할 수 없습니다.");
    const row = await prisma.dailyWorkPlan.update({
      where: { id },
      data: { status: DailyPlanStatus.REJECTED, reviewedById: user.id, reviewedAt: new Date(), reviewMemo: input.memo },
      include: planInclude
    });

    const recipients = Array.from(new Set(row.items.map((item) => item.mechanicId).filter(Boolean) as string[]));
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((recipientId) => ({
          userId: recipientId,
          type: "DAILY_PLAN_REVIEWED",
          title: "계획업무 반려",
          body: `${user.name}님이 계획업무를 반려했습니다. 사유: ${input.memo}`
        }))
      });
    }

    await auditLog({ user, request, action: "daily_plan.reject", targetType: "dailyWorkPlan", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
