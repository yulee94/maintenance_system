import { NextRequest } from "next/server";
import { RoleCode, WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoWorkOrders } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    if (appEnv.demoMode) {
      return ok((await demoWorkOrders()).filter((row) => row.isDelayed || row.status === WorkOrderStatus.DELAYED));
    }
    const rows = await prisma.workOrder.findMany({
      where: { OR: [{ isDelayed: true }, { status: WorkOrderStatus.DELAYED }], archivedAt: null, deletedAt: null },
      include: workOrderInclude,
      orderBy: [{ targetDueDate: "asc" }]
    });
    return ok(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
