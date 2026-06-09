import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, ok, parseDateInput } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoWorkOrders } from "@/lib/demo";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    if (appEnv.demoMode) return ok(await demoWorkOrders());
    const from = parseDateInput(request.nextUrl.searchParams.get("from") ?? undefined);
    const to = parseDateInput(request.nextUrl.searchParams.get("to") ?? undefined);
    const rows = await prisma.workOrder.findMany({
      where: {
        archivedAt: null,
        deletedAt: null,
        targetDueDate: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {})
        }
      },
      include: { customer: true, site: true, assignedMechanic: { select: { id: true, name: true } } },
      orderBy: [{ targetDueDate: "asc" }, { priorityLevel: "asc" }]
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
