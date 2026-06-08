import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { workOrderInclude } from "@/lib/work-orders";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const equipment = await prisma.equipment.findUnique({ where: { id }, select: { id: true } });
    if (!equipment) throw new ApiError(404, "장비를 찾을 수 없습니다.");
    const rows = await prisma.workOrder.findMany({
      where: { equipmentId: id },
      include: workOrderInclude,
      orderBy: { requestDate: "desc" }
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
