import { PriorityLevel, WorkOrderStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/db";

const completedStatuses: WorkOrderStatus[] = [WorkOrderStatus.FINAL_COMPLETED];
const activeStatuses: WorkOrderStatus[] = [
  WorkOrderStatus.RECEIVED,
  WorkOrderStatus.UNASSIGNED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.REPORT_SUBMITTED,
  WorkOrderStatus.ADMIN_REVIEW,
  WorkOrderStatus.DELAYED,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TEMPORARY_ACTION,
  WorkOrderStatus.PART_WAITING,
  WorkOrderStatus.EQUIPMENT_IN_USE,
  WorkOrderStatus.REVISIT_REQUIRED
];

export async function getDashboardSummary() {
  const [total, completed, pending, delayed, planned, urgent] = await Promise.all([
    prisma.workOrder.count({ where: { archivedAt: null, deletedAt: null } }),
    prisma.workOrder.count({ where: { status: { in: completedStatuses }, archivedAt: null, deletedAt: null } }),
    prisma.workOrder.count({ where: { status: { in: activeStatuses }, archivedAt: null, deletedAt: null } }),
    prisma.workOrder.count({ where: { OR: [{ isDelayed: true }, { status: WorkOrderStatus.DELAYED }], archivedAt: null, deletedAt: null } }),
    prisma.dailyWorkPlanItem.count(),
    prisma.workOrder.count({ where: { priorityLevel: PriorityLevel.P1, status: { in: activeStatuses }, archivedAt: null, deletedAt: null } })
  ]);

  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pending, delayed, planned, urgent, completionRate };
}

export async function getMechanicKpi() {
  const mechanics = await prisma.user.findMany({
    where: { roles: { some: { role: { code: "MECHANIC" } } } },
    select: {
      id: true,
      name: true,
      title: true,
      assignedWorkOrders: {
        where: { archivedAt: null, deletedAt: null },
        select: {
          status: true,
          priorityLevel: true,
          targetDueDate: true,
          finalCompletedAt: true,
          resultType: true,
          kpiExcluded: true
        }
      }
    }
  });

  return mechanics.map((mechanic) => {
    const assigned = mechanic.assignedWorkOrders;
    const completed = assigned.filter((order) => order.status === WorkOrderStatus.FINAL_COMPLETED && !order.kpiExcluded);
    const delayed = assigned.filter((order) => order.targetDueDate && order.finalCompletedAt && differenceInCalendarDays(order.finalCompletedAt, order.targetDueDate) > 0);
    return {
      id: mechanic.id,
      name: mechanic.name,
      title: mechanic.title,
      assigned: assigned.length,
      completed: completed.length,
      temporaryActions: assigned.filter((order) => order.resultType === "TEMPORARY_ACTION").length,
      pending: assigned.filter((order) => activeStatuses.includes(order.status)).length,
      delayed: delayed.length,
      p1Completed: completed.filter((order) => order.priorityLevel === PriorityLevel.P1).length,
      targetComplianceRate: completed.length ? Math.round(((completed.length - delayed.length) / completed.length) * 100) : 0
    };
  });
}

export async function getPriorityKpi() {
  const priorities = [PriorityLevel.P1, PriorityLevel.P2, PriorityLevel.P3, PriorityLevel.OUTSOURCE, PriorityLevel.UNSET];
  return Promise.all(
    priorities.map(async (priority) => {
      const [received, completed, pending, delayed] = await Promise.all([
        prisma.workOrder.count({ where: { priorityLevel: priority, archivedAt: null, deletedAt: null } }),
        prisma.workOrder.count({ where: { priorityLevel: priority, status: WorkOrderStatus.FINAL_COMPLETED, kpiExcluded: false, archivedAt: null, deletedAt: null } }),
        prisma.workOrder.count({ where: { priorityLevel: priority, status: { in: activeStatuses }, archivedAt: null, deletedAt: null } }),
        prisma.workOrder.count({ where: { priorityLevel: priority, OR: [{ isDelayed: true }, { status: WorkOrderStatus.DELAYED }], archivedAt: null, deletedAt: null } })
      ]);
      return { priority, received, completed, pending, delayed };
    })
  );
}
