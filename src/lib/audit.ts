import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";

type AuditInput = {
  user?: AuthUser | null;
  request?: NextRequest;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function auditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.user?.id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      ipAddress: input.request?.headers.get("x-forwarded-for") ?? undefined,
      userAgent: input.request?.headers.get("user-agent") ?? undefined
    }
  });
}
