import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";

const updateSchema = z.object({
  status: z.string().optional(),
  managerName: z.string().optional(),
  location: z.string().optional(),
  operationType: z.string().optional(),
  operatingHours: z.string().optional()
});

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, updateSchema);
    if (appEnv.demoMode) return ok({ id, ...input });
    const row = await prisma.equipment.update({
      where: { id },
      data: input,
      include: { customer: true, site: true }
    });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
