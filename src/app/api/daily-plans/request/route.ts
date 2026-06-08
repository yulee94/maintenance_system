import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { created, handleApiError, parseDateInput, readJson, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  planDate: z.string().min(1),
  workOrderIds: z.array(z.string()).min(1)
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = await readJson(request, schema);
    const planDate = parseDateInput(input.planDate);
    if (!planDate) throw new ApiError(422, "계획일자가 올바르지 않습니다.");
    const row = await prisma.dailyWorkPlan.create({
      data: {
        planDate,
        requestedById: user.id,
        items: {
          create: input.workOrderIds.map((workOrderId, index) => ({
            workOrderId,
            mechanicId: user.id,
            orderIndex: index + 1
          }))
        }
      },
      include: { items: true }
    });
    await auditLog({ user, request, action: "daily_plan.request", targetType: "dailyWorkPlan", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
