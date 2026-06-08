import { NextRequest } from "next/server";
import { RoleCode, WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { workOrderInclude } from "@/lib/work-orders";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
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
