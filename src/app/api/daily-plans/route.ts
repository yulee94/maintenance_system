import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const rows = await prisma.dailyWorkPlan.findMany({
      include: {
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        items: {
          include: {
            mechanic: { select: { id: true, name: true } },
            workOrder: { include: { customer: true, site: true, assignedMechanic: { select: { id: true, name: true } } } }
          },
          orderBy: { orderIndex: "asc" }
        }
      },
      orderBy: { planDate: "desc" },
      take: 120
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
