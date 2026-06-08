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
    const before = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!before) throw new ApiError(404, "사용자를 찾을 수 없습니다.");
    if (!user.roles.includes(RoleCode.SUPER_ADMIN) && before.roles.some((role) => role.role.code === RoleCode.SUPER_ADMIN)) {
      throw new ApiError(403, "최고 관리자 계정은 최고 관리자만 비활성화할 수 있습니다.");
    }
    if (user.id === id) {
      throw new ApiError(403, "본인 계정은 직접 비활성화할 수 없습니다.");
    }

    const row = await prisma.user.update({ where: { id }, data: { isActive: false } });
    await auditLog({ user, request, action: "admin.user.deactivate", targetType: "user", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
