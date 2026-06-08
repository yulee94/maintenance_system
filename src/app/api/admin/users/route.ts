import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { created, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const createSchema = z.object({
  loginId: z.string().min(2),
  name: z.string().min(1),
  title: z.string().optional(),
  team: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  roleCodes: z.array(z.nativeEnum(RoleCode)).min(1),
  temporaryPassword: z.string().min(10).default("ChangeMe!2026")
});

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN]);
    const rows = await prisma.user.findMany({
      include: {
        roles: { include: { role: true } },
        mechanicProfile: true
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const input = await readJson(request, createSchema);
    const row = await prisma.user.create({
      data: {
        loginId: input.loginId,
        name: input.name,
        title: input.title,
        team: input.team,
        phone: input.phone,
        email: input.email,
        passwordHash: await bcrypt.hash(input.temporaryPassword, 10),
        mustChangePassword: true,
        roles: {
          create: input.roleCodes.map((code) => ({
            role: { connect: { code } }
          }))
        },
        mechanicProfile: input.roleCodes.includes(RoleCode.MECHANIC)
          ? { create: { team: input.team, canReceiveWork: true } }
          : undefined
      },
      include: { roles: { include: { role: true } }, mechanicProfile: true }
    });
    await auditLog({ user, request, action: "admin.user.create", targetType: "user", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
