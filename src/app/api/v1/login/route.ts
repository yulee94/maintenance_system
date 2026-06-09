import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { RoleCode } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { demoLogin } from "@/lib/demo";
import { appEnv } from "@/lib/env";
import { buildMfaChallenge, buildMobileAuthFlow } from "@/lib/mobile-auth-policy";
import { mobileBranchesForUser } from "@/lib/mobile-api";

const schema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
  otpCode: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const input = await readJson(request, schema);
    const deviceId = request.headers.get("x-device-id");
    if (appEnv.mobileDeviceRegistrationRequired && !deviceId) {
      throw new ApiError(400, "모바일 기기 식별자가 필요합니다.");
    }

    if (appEnv.demoMode) {
      const demoUser = await demoLogin(input.loginId, input.password);
      if (!demoUser) throw new ApiError(401, "아이디 또는 비밀번호를 확인하세요.");
      const branchCount = (await mobileBranchesForUser(demoUser)).length;

      if (appEnv.mobileMfaRequired && !input.otpCode) {
        return ok({
          apiVersion: "v1",
          ...buildMfaChallenge(input.loginId),
          authFlow: buildMobileAuthFlow({
            user: demoUser,
            mfaRequired: true,
            mfaVerified: false,
            deviceId,
            deviceRegistrationRequired: appEnv.mobileDeviceRegistrationRequired,
            branchCount
          })
        });
      }

      if (appEnv.mobileMfaRequired && input.otpCode !== appEnv.mobileTestOtpCode) {
        throw new ApiError(401, "OTP 또는 MFA 인증번호를 확인하세요.");
      }

      const token = await signSession(demoUser);
      const response = ok({
        ...demoUser,
        sessionToken: token,
        expiresInHours: 8,
        apiVersion: "v1",
        authFlow: buildMobileAuthFlow({
          user: demoUser,
          mfaRequired: appEnv.mobileMfaRequired,
          mfaVerified: true,
          deviceId,
          deviceRegistrationRequired: appEnv.mobileDeviceRegistrationRequired,
          branchCount
        })
      });
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
      return response;
    }

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
        action: "mobile.auth.login_failed",
        targetType: "user",
        targetId: user.id,
        after: { loginId: user.loginId, failCount }
      });
      throw new ApiError(401, "아이디 또는 비밀번호를 확인하세요.");
    }

    const authUser = {
      id: user.id,
      loginId: user.loginId,
      name: user.name,
      roles: user.roles.map((item) => item.role.code as RoleCode),
      mustChangePassword: user.mustChangePassword
    };
    const branchCount = (await mobileBranchesForUser(authUser)).length;

    if (appEnv.mobileMfaRequired && !input.otpCode) {
      await auditLog({
        user: authUser,
        request,
        action: "mobile.auth.mfa_required",
        targetType: "user",
        targetId: user.id
      });
      return ok({
        apiVersion: "v1",
        ...buildMfaChallenge(input.loginId),
        authFlow: buildMobileAuthFlow({
          user: authUser,
          mfaRequired: true,
          mfaVerified: false,
          deviceId,
          deviceRegistrationRequired: appEnv.mobileDeviceRegistrationRequired,
          branchCount
        })
      });
    }

    if (appEnv.mobileMfaRequired && input.otpCode !== appEnv.mobileTestOtpCode) {
      await auditLog({
        user: authUser,
        request,
        action: "mobile.auth.mfa_failed",
        targetType: "user",
        targetId: user.id
      });
      throw new ApiError(401, "OTP 또는 MFA 인증번호를 확인하세요.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { loginFailCount: 0, lockedUntil: null, lastLoginAt: new Date() }
    });

    const token = await signSession(authUser);
    const response = ok({
      ...authUser,
      sessionToken: token,
      expiresInHours: 8,
      apiVersion: "v1",
      authFlow: buildMobileAuthFlow({
        user: authUser,
        mfaRequired: appEnv.mobileMfaRequired,
        mfaVerified: true,
        deviceId,
        deviceRegistrationRequired: appEnv.mobileDeviceRegistrationRequired,
        branchCount
      })
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    await auditLog({ user: authUser, request, action: "mobile.auth.login", targetType: "user", targetId: user.id });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
