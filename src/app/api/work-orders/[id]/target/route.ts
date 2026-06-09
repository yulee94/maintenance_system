import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoUpdateTarget } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

const schema = z.object({
  targetDueDate: z.string().min(1),
  reason: z.string().optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    if (appEnv.demoMode) return ok(await demoUpdateTarget(id, input.targetDueDate, input.reason));
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const newDate = parseDateInput(input.targetDueDate);
    if (!newDate) throw new ApiError(422, "목표일 날짜가 올바르지 않습니다.");
    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        targetDueDate: newDate,
        updatedById: user.id,
        targetHistories: {
          create: {
            oldDate: before.targetDueDate,
            newDate,
            reason: input.reason ?? "관리자 목표일 지정",
            changedById: user.id
          }
        }
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "work_order.target", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
