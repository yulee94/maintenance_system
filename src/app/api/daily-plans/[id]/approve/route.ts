import { NextRequest } from "next/server";
import { DailyPlanStatus, RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const before = await prisma.dailyWorkPlan.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "계획업무를 찾을 수 없습니다.");
    const row = await prisma.dailyWorkPlan.update({
      where: { id },
      data: { status: DailyPlanStatus.APPROVED, reviewedById: user.id, reviewedAt: new Date() },
      include: { items: true }
    });
    await auditLog({ user, request, action: "daily_plan.approve", targetType: "dailyWorkPlan", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
