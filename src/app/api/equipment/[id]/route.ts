import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const row = await prisma.equipment.findUnique({ where: { id }, include: { customer: true, site: true } });
    if (!row) throw new ApiError(404, "장비를 찾을 수 없습니다.");
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
