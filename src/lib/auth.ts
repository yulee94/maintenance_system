import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { ApiError } from "@/lib/api";

export const SESSION_COOKIE = "maintenance_session";
const SESSION_HOURS = 8;

const secretKey = new TextEncoder().encode(appEnv.jwtSecret);

export type AuthUser = {
  id: string;
  loginId: string;
  name: string;
  roles: RoleCode[];
  mustChangePassword: boolean;
};

export async function signSession(user: AuthUser) {
  return new SignJWT({
    loginId: user.loginId,
    name: user.name,
    roles: user.roles
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey);
}

export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const verified = await jwtVerify(token, secretKey);
    const userId = verified.payload.sub;
    if (!userId) return null;

    if (appEnv.demoMode) {
      return {
        id: userId,
        loginId: String(verified.payload.loginId ?? ""),
        name: String(verified.payload.name ?? "Demo User"),
        roles: Array.isArray(verified.payload.roles) ? (verified.payload.roles as RoleCode[]) : [],
        mustChangePassword: false
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });

    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      loginId: user.loginId,
      name: user.name,
      roles: user.roles.map((item) => item.role.code),
      mustChangePassword: user.mustChangePassword
    };
  } catch {
    return null;
  }
}

export async function getCurrentUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentUserFromCookies(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireUser(request: NextRequest, allowedRoles?: RoleCode[]) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) throw new ApiError(401, "Login is required.");
  if (user.roles.includes(RoleCode.SUPER_ADMIN)) return user;
  if (allowedRoles?.length && !allowedRoles.some((role) => user.roles.includes(role))) {
    throw new ApiError(403, "You do not have permission for this action.");
  }
  return user;
}

export function canAccessKpi(user: AuthUser) {
  return user.roles.includes(RoleCode.SUPER_ADMIN) || user.roles.includes(RoleCode.ADMIN) || user.roles.includes(RoleCode.EXECUTIVE);
}

export function canAdmin(user: AuthUser) {
  return user.roles.includes(RoleCode.SUPER_ADMIN) || user.roles.includes(RoleCode.ADMIN);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && appEnv.appBaseUrl.startsWith("https://"),
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60
};
