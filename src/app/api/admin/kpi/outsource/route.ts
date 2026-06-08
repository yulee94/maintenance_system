import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    const rows = await prisma.outsourceWork.findMany({
      include: { vendor: true, workOrder: { include: { customer: true, site: true } } },
      orderBy: { requestDate: "desc" },
      take: 200
    });
    const summary = {
      requested: rows.length,
      completed: rows.filter((row) => row.status === "COMPLETED").length,
      delayed: rows.filter((row) => row.targetDate && !row.completedAt && row.targetDate < new Date()).length,
      costTotal: rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0)
    };
    return ok({ summary, rows });
  } catch (error) {
    return handleApiError(error);
  }
}
