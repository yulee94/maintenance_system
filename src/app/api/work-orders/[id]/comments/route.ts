import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, created, handleApiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  body: z.string().min(1),
  isInternal: z.boolean().default(false)
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const exists = await prisma.workOrder.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const input = await readJson(request, schema);
    const row = await prisma.comment.create({
      data: { workOrderId: id, authorId: user.id, body: input.body, isInternal: input.isInternal },
      include: { author: { select: { id: true, name: true, title: true } } }
    });
    await auditLog({ user, request, action: "work_order.comment", targetType: "comment", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
