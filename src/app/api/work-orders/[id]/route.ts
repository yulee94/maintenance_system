import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { workOrderInclude } from "@/lib/work-orders";

const updateSchema = z.object({
  contactPhone: z.string().optional(),
  faultCategoryId: z.string().optional(),
  faultDescription: z.string().optional(),
  memo: z.string().optional(),
  targetDueDate: z.string().optional()
});

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const row = await prisma.workOrder.findUnique({ where: { id }, include: workOrderInclude });
    if (!row) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN, RoleCode.RECEPTIONIST]);
    const { id } = await context.params;
    const input = await readJson(request, updateSchema);
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");

    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        contactPhone: input.contactPhone,
        faultCategoryId: input.faultCategoryId,
        faultDescription: input.faultDescription,
        memo: input.memo,
        targetDueDate: parseDateInput(input.targetDueDate),
        updatedById: user.id
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "work_order.update", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
