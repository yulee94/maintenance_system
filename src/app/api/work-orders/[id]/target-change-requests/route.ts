import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, created, handleApiError, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  requestedDate: z.string().min(1),
  reason: z.string().min(1)
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    const workOrder = await prisma.workOrder.findUnique({ where: { id } });
    if (!workOrder) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const requestedDate = parseDateInput(input.requestedDate);
    if (!requestedDate) throw new ApiError(422, "요청 날짜가 올바르지 않습니다.");
    const row = await prisma.targetChangeRequest.create({
      data: {
        workOrderId: id,
        requestedById: user.id,
        currentDate: workOrder.targetDueDate,
        requestedDate,
        reason: input.reason
      }
    });
    await auditLog({ user, request, action: "work_order.target_change_request", targetType: "targetChangeRequest", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
