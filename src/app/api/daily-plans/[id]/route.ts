import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  planDate: z.string().optional(),
  reviewMemo: z.string().optional()
});

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    const before = await prisma.dailyWorkPlan.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "계획업무를 찾을 수 없습니다.");
    const row = await prisma.dailyWorkPlan.update({
      where: { id },
      data: {
        planDate: parseDateInput(input.planDate),
        reviewMemo: input.reviewMemo
      },
      include: { items: true }
    });
    await auditLog({ user, request, action: "daily_plan.update", targetType: "dailyWorkPlan", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
