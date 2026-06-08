import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(10)
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = await readJson(request, schema);
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    if (!row) throw new ApiError(404, "사용자를 찾을 수 없습니다.");

    if (!row.mustChangePassword) {
      const currentOk = input.currentPassword
        ? await bcrypt.compare(input.currentPassword, row.passwordHash)
        : false;
      if (!currentOk) throw new ApiError(401, "현재 비밀번호가 맞지 않습니다.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(input.newPassword, 10),
        mustChangePassword: false,
        loginFailCount: 0,
        lockedUntil: null
      }
    });
    await auditLog({ user, request, action: "auth.change_password", targetType: "user", targetId: user.id });
    return ok({ changed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
