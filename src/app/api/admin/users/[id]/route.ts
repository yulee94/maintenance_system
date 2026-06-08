import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  team: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().nullable(),
  isActive: z.boolean().optional(),
  roleCodes: z.array(z.nativeEnum(RoleCode)).optional(),
  resetPassword: z.string().min(10).optional()
});

const elevatedRoles = new Set<RoleCode>([RoleCode.SUPER_ADMIN, RoleCode.ADMIN, RoleCode.EXECUTIVE]);

function assertCanManageRoles(actorRoles: RoleCode[], currentRoles: RoleCode[], nextRoles?: RoleCode[]) {
  const actorIsSuperAdmin = actorRoles.includes(RoleCode.SUPER_ADMIN);
  if (actorIsSuperAdmin) return;

  if (currentRoles.includes(RoleCode.SUPER_ADMIN)) {
    throw new ApiError(403, "최고 관리자 계정은 최고 관리자만 수정할 수 있습니다.");
  }

  if (nextRoles?.some((role) => elevatedRoles.has(role))) {
    throw new ApiError(403, "최고 관리자만 관리자/임원/최고 관리자 권한을 부여할 수 있습니다.");
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, updateSchema);
    const before = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    if (!before) throw new ApiError(404, "사용자를 찾을 수 없습니다.");
    assertCanManageRoles(
      user.roles,
      before.roles.map((role) => role.role.code),
      input.roleCodes
    );

    const row = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        title: input.title,
        team: input.team,
        phone: input.phone,
        email: input.email ?? undefined,
        isActive: input.isActive,
        passwordHash: input.resetPassword ? await bcrypt.hash(input.resetPassword, 10) : undefined,
        mustChangePassword: input.resetPassword ? true : undefined,
        roles: input.roleCodes
          ? {
              deleteMany: {},
              create: input.roleCodes.map((code) => ({ role: { connect: { code } } }))
            }
          : undefined
      },
      include: { roles: { include: { role: true } }, mechanicProfile: true }
    });
    await auditLog({ user, request, action: "admin.user.update", targetType: "user", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}
