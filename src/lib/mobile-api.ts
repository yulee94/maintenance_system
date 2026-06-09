import { PriorityLevel, RoleCode, WorkOrderStatus } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { demoWorkOrders } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

const closedStatuses = new Set<string>([
  WorkOrderStatus.FINAL_COMPLETED,
  WorkOrderStatus.ARCHIVED,
  WorkOrderStatus.CANCELLED
]);

const plannedStatuses = new Set<string>([
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.PART_WAITING,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.REVISIT_REQUIRED
]);

const hiddenStatuses = new Set<string>([WorkOrderStatus.ARCHIVED, WorkOrderStatus.CANCELLED]);

type MobileRef = {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  phone?: string | null;
  team?: string | null;
};

type MobileTaskSource = {
  id: string;
  requestNo: string;
  customer?: MobileRef | null;
  site?: MobileRef | null;
  equipment?: {
    id?: string | null;
    normalizedNo?: string | null;
    equipmentNo?: string | null;
    placementNo?: string | null;
    modelName?: string | null;
    serialNo?: string | null;
    tonnage?: string | null;
    maker?: string | null;
    vehicleRegistrationNo?: string | null;
    customer?: { name?: string | null } | null;
    site?: { name?: string | null } | null;
  } | null;
  equipmentInput?: string | null;
  equipmentNoNormalized?: string | null;
  requestDate: string | Date;
  requestedAt?: string | Date | null;
  contactPhone?: string | null;
  faultDescription: string;
  priorityLevel: PriorityLevel | string;
  status: WorkOrderStatus | string;
  targetDueDate?: string | Date | null;
  assignedMechanic?: MobileRef | null;
  resultType?: string | null;
  diagnosisResult?: string | null;
  actionTaken?: string | null;
  memo?: string | null;
  mechanicReportedAt?: string | Date | null;
  adminApprovedAt?: string | Date | null;
  finalCompletedAt?: string | Date | null;
  isDelayed?: boolean | null;
  reports?: {
    id: string;
    resultType?: string | null;
    diagnosisResult?: string | null;
    actionTaken?: string | null;
    submittedAt?: string | Date | null;
    attachments?: unknown[];
  }[];
};

export type MobileTask = {
  id: string;
  requestNo: string;
  branchId: string;
  branchName: string;
  requestDate: string;
  requestedAt: string | null;
  equipmentInput: string | null;
  equipmentNoNormalized: string | null;
  faultDescription: string;
  priorityLevel: string;
  status: string;
  targetDueDate: string | null;
  contactPhone: string | null;
  actionTaken: string | null;
  diagnosisResult: string | null;
  memo: string | null;
  isDelayed: boolean;
  customer: MobileRef | null;
  site: MobileRef | null;
  equipment: MobileTaskSource["equipment"];
  assignedMechanic: MobileRef | null;
  reports: {
    id: string;
    resultType: string | null;
    diagnosisResult: string | null;
    actionTaken: string | null;
    submittedAt: string | null;
  }[];
};

export type MobileBranch = {
  id: string;
  code: string;
  name: string;
  customerId: string | null;
  customerName: string | null;
  isActive: boolean;
  source: "site" | "demo";
};

export type MobileTaskSummary = {
  total: number;
  completed: number;
  pending: number;
  delayed: number;
  planned: number;
  urgent: number;
  completionRate: number;
};

export type MobileTaskFilters = {
  scope?: string | null;
  status?: string | null;
  priority?: string | null;
  branchId?: string | null;
  search?: string | null;
};

export async function mobileTasksForUser(user: AuthUser): Promise<MobileTask[]> {
  if (appEnv.demoMode) {
    const rows = scopeSourceRows(await demoWorkOrders(), user);
    return rows.map(toMobileTask);
  }

  const rows = await prisma.workOrder.findMany({
    where: {
      archivedAt: null,
      deletedAt: null,
      ...(!canViewAllMobileData(user) && user.roles.includes(RoleCode.MECHANIC)
        ? { assignedMechanicId: user.id }
        : {})
    },
    include: workOrderInclude,
    orderBy: [{ priorityLevel: "asc" }, { requestDate: "desc" }, { createdAt: "desc" }],
    take: 200
  });

  return rows.map((row) => toMobileTask(row as unknown as MobileTaskSource));
}

export async function mobileBranchesForUser(user: AuthUser): Promise<MobileBranch[]> {
  if (appEnv.demoMode) {
    const rows = scopeSourceRows(await demoWorkOrders(), user);
    const branches = new Map<string, MobileBranch>();
    for (const row of rows) {
      const branchId = row.site?.id ?? row.customer?.id ?? "demo-unassigned";
      const branchName = row.site?.name ?? row.customer?.name ?? "미지정 사업장";
      if (branches.has(branchId)) continue;
      branches.set(branchId, {
        id: branchId,
        code: branchCode(branchName, branchId),
        name: branchName,
        customerId: row.customer?.id ?? null,
        customerName: row.customer?.name ?? null,
        isActive: true,
        source: "demo"
      });
    }
    return Array.from(branches.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }

  const rows = await prisma.site.findMany({
    where: {
      isActive: true,
      ...(!canViewAllMobileData(user) && user.roles.includes(RoleCode.MECHANIC)
        ? {
            OR: [
              { defaultMechanicId: user.id },
              { assignments: { some: { mechanicId: user.id } } },
              { workOrders: { some: { assignedMechanicId: user.id, archivedAt: null, deletedAt: null } } }
            ]
          }
        : {})
    },
    include: { customer: true },
    orderBy: [{ name: "asc" }]
  });

  return rows.map((row) => ({
    id: row.id,
    code: branchCode(row.name, row.id),
    name: row.name,
    customerId: row.customerId,
    customerName: row.customer?.name ?? null,
    isActive: row.isActive,
    source: "site"
  }));
}

export function toMobileTask(row: MobileTaskSource): MobileTask {
  const branchId = row.site?.id ?? row.customer?.id ?? "unassigned";
  const branchName = row.site?.name ?? row.customer?.name ?? "미지정 사업장";
  return {
    id: row.id,
    requestNo: row.requestNo,
    branchId,
    branchName,
    requestDate: requiredIso(row.requestDate),
    requestedAt: iso(row.requestedAt),
    equipmentInput: row.equipmentInput ?? null,
    equipmentNoNormalized: row.equipmentNoNormalized ?? row.equipment?.normalizedNo ?? null,
    faultDescription: row.faultDescription,
    priorityLevel: String(row.priorityLevel),
    status: String(row.status),
    targetDueDate: iso(row.targetDueDate),
    contactPhone: row.contactPhone ?? null,
    actionTaken: row.actionTaken ?? null,
    diagnosisResult: row.diagnosisResult ?? null,
    memo: row.memo ?? null,
    isDelayed: Boolean(row.isDelayed || row.status === WorkOrderStatus.DELAYED),
    customer: row.customer ?? null,
    site: row.site ?? null,
    equipment: row.equipment ?? null,
    assignedMechanic: row.assignedMechanic ?? null,
    reports: (row.reports ?? []).map((report) => ({
      id: report.id,
      resultType: report.resultType ?? null,
      diagnosisResult: report.diagnosisResult ?? null,
      actionTaken: report.actionTaken ?? null,
      submittedAt: iso(report.submittedAt)
    }))
  };
}

export function filterMobileTasks(tasks: MobileTask[], filters: MobileTaskFilters) {
  let rows = tasks;
  const scope = filters.scope ?? "all";
  const status = filters.status?.trim();
  const priority = filters.priority?.trim();
  const branchId = filters.branchId?.trim();
  const search = filters.search?.trim().toLowerCase();

  if (scope === "open") rows = rows.filter((row) => !isMobileTaskClosed(row));
  if (scope === "completed") rows = rows.filter(isMobileTaskClosed);
  if (scope === "urgent") rows = rows.filter((row) => row.priorityLevel === PriorityLevel.P1 && !isMobileTaskClosed(row));
  if (scope === "delayed") rows = rows.filter((row) => row.isDelayed || row.status === WorkOrderStatus.DELAYED);
  if (scope === "today") {
    const today = localDateKey(new Date());
    rows = rows.filter((row) => localDateKey(new Date(row.requestDate)) === today);
  }
  if (status) rows = rows.filter((row) => row.status === status);
  if (priority) rows = rows.filter((row) => row.priorityLevel === priority);
  if (branchId) rows = rows.filter((row) => row.branchId === branchId);
  if (search) {
    rows = rows.filter((row) =>
      [
        row.requestNo,
        row.branchName,
        row.customer?.name,
        row.site?.name,
        row.equipmentInput,
        row.equipmentNoNormalized,
        row.faultDescription,
        row.assignedMechanic?.name
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }
  return rows;
}

export function mobileTaskSummary(tasks: MobileTask[]): MobileTaskSummary {
  const activeRows = tasks.filter((row) => !hiddenStatuses.has(row.status));
  const total = activeRows.length;
  const completed = activeRows.filter((row) => row.status === WorkOrderStatus.FINAL_COMPLETED).length;
  const pending = activeRows.filter((row) => !isMobileTaskClosed(row)).length;
  const delayed = activeRows.filter((row) => row.isDelayed || row.status === WorkOrderStatus.DELAYED).length;
  const planned = activeRows.filter((row) => plannedStatuses.has(row.status)).length;
  const urgent = activeRows.filter((row) => row.priorityLevel === PriorityLevel.P1 && !isMobileTaskClosed(row)).length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pending, delayed, planned, urgent, completionRate };
}

export function canAccessMobileTask(user: AuthUser, assignedMechanicId?: string | null) {
  if (canViewAllMobileData(user)) return true;
  return user.roles.includes(RoleCode.MECHANIC) && assignedMechanicId === user.id;
}

export function isMobileTaskClosed(row: Pick<MobileTask, "status">) {
  return closedStatuses.has(row.status);
}

function canViewAllMobileData(user: AuthUser) {
  return [RoleCode.SUPER_ADMIN, RoleCode.ADMIN, RoleCode.EXECUTIVE, RoleCode.RECEPTIONIST].some((role) =>
    user.roles.includes(role)
  );
}

function scopeSourceRows(rows: MobileTaskSource[], user: AuthUser) {
  if (canViewAllMobileData(user)) return rows;
  if (user.roles.includes(RoleCode.MECHANIC)) {
    return rows.filter((row) => row.assignedMechanic?.id === user.id);
  }
  return rows.filter((row) => !closedStatuses.has(String(row.status)));
}

function iso(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function requiredIso(value: string | Date) {
  return iso(value) ?? new Date().toISOString();
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function branchCode(name: string, id: string) {
  const prefix = name.replace(/\s+/g, "").slice(0, 6).toUpperCase() || "BR";
  return `${prefix}-${id.slice(-4).toUpperCase()}`;
}
