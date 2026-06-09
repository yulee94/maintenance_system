import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoDailyPlans } from "@/lib/demo";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    if (appEnv.demoMode) return ok(await demoDailyPlans());
    const rows = await prisma.dailyWorkPlan.findMany({
      include: {
        requestedBy: { select: { id: true, name: true, title: true } },
        reviewedBy: { select: { id: true, name: true, title: true } },
        items: {
          include: {
            mechanic: { select: { id: true, name: true, title: true } },
            workOrder: {
              include: {
                customer: true,
                site: true,
                equipment: true,
                assignedMechanic: { select: { id: true, name: true, title: true, phone: true } }
              }
            }
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
