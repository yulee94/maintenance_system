import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "사용자를 찾을 수 없습니다.");
    const row = await prisma.user.update({ where: { id }, data: { isActive: false } });
    await auditLog({ user, request, action: "admin.user.deactivate", targetType: "user", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
