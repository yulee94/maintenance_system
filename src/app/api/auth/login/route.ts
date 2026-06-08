import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { handleApiError, ok, readJson, ApiError } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";

const schema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const input = await readJson(request, schema);
    const user = await prisma.user.findUnique({
      where: { loginId: input.loginId },
      include: { roles: { include: { role: true } } }
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, "아이디 또는 비밀번호를 확인하세요.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError(423, "로그인 실패 횟수 초과로 계정이 잠시 잠겼습니다.");
    }

    const passwordOk = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      const failCount = user.loginFailCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginFailCount: failCount,
          lockedUntil: failCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
        }
      });
      await auditLog({
        request,
        action: "auth.login_failed",
        targetType: "user",
        targetId: user.id,
        after: { loginId: user.loginId, failCount }
      });
      throw new ApiError(401, "아이디 또는 비밀번호를 확인하세요.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { loginFailCount: 0, lockedUntil: null, lastLoginAt: new Date() }
    });

    const authUser = {
      id: user.id,
      loginId: user.loginId,
      name: user.name,
      roles: user.roles.map((item) => item.role.code),
      mustChangePassword: user.mustChangePassword
    };
    const token = await signSession(authUser);
    const response = ok(authUser);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    await auditLog({ user: authUser, request, action: "auth.login", targetType: "user", targetId: user.id });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
