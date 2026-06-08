import { NextRequest } from "next/server";
import { RoleCode, WorkOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoRejectWorkOrder } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

const schema = z.object({
  reason: z.string().min(1)
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    if (appEnv.demoMode) return ok(demoRejectWorkOrder(id, input.reason));
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.REJECTED,
        updatedById: user.id,
        statusHistories: { create: { fromStatus: before.status, toStatus: WorkOrderStatus.REJECTED, changedById: user.id, reason: input.reason } },
        comments: { create: { authorId: user.id, body: `반려: ${input.reason}`, isInternal: false } }
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "work_order.reject", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
