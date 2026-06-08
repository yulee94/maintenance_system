import { NextRequest } from "next/server";
import { PriorityLevel, RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { workOrderInclude } from "@/lib/work-orders";

const schema = z.object({
  priorityLevel: z.nativeEnum(PriorityLevel),
  reason: z.string().optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const row = await prisma.workOrder.update({
      where: { id },
      data: { priorityLevel: input.priorityLevel, updatedById: user.id },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "work_order.priority", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
