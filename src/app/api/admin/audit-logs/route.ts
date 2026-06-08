import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN]);
    const rows = await prisma.auditLog.findMany({
      include: { actor: { select: { id: true, name: true, loginId: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
