import { NextRequest } from "next/server";
import { Prisma, RoleCode, WorkOrderStatus, WorkResultType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoApproveWorkOrder } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

const schema = z.object({
  memo: z.string().optional(),
  kpiExcluded: z.boolean().optional(),
  kpiExclusionReason: z.string().optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    if (appEnv.demoMode) return ok(await demoApproveWorkOrder(id, input, user));
    const before = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        assignedMechanic: { select: { id: true, name: true, title: true } },
        reports: { orderBy: { submittedAt: "desc" }, take: 1 }
      }
    });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const approvalLine = await approveNextStep(before, user, input.memo);
    const allApproved = approvalLine.filter((item) => item.role !== "MECHANIC").every((item) => item.status === "APPROVED");
    const finalCompleted = allApproved && before.resultType === WorkResultType.COMPLETED;
    const nextStatus = allApproved
      ? finalCompleted
        ? WorkOrderStatus.FINAL_COMPLETED
        : WorkOrderStatus.TEMPORARY_ACTION
      : WorkOrderStatus.ADMIN_REVIEW;
    const adminApprovedAt = approvalLine.find((item) => item.role === "ADMIN")?.approvedAt;
    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        status: nextStatus,
        approvalLine: approvalLine as unknown as Prisma.InputJsonValue,
        adminApprovedAt: adminApprovedAt ? new Date(adminApprovedAt) : before.adminApprovedAt,
        finalCompletedAt: allApproved && finalCompleted ? new Date() : before.finalCompletedAt,
        kpiExcluded: input.kpiExcluded ?? before.kpiExcluded,
        kpiExclusionReason: input.kpiExclusionReason ?? before.kpiExclusionReason,
        updatedById: user.id,
        statusHistories: { create: { fromStatus: before.status, toStatus: nextStatus, changedById: user.id, reason: input.memo ?? "결재 승인" } },
        kpiExclusions:
          input.kpiExcluded && input.kpiExclusionReason
            ? { create: { reason: input.kpiExclusionReason, createdById: user.id } }
            : undefined
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "work_order.approve", targetType: "workOrder", targetId: id, before, after: row });
    return ok(row);
  } catch (error) {
    return handleApiError(error);
  }
}

type ApprovalStep = {
  id: string;
  role: "MECHANIC" | "ADMIN" | "EXECUTIVE";
  label: string;
  approverId?: string | null;
  approverName?: string | null;
  approverTitle?: string | null;
  status: "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED";
  requestedAt?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  memo?: string | null;
};

type ApprovalWorkOrder = {
  approvalLine: Prisma.JsonValue | null;
  assignedMechanic?: { id: string; name: string; title?: string | null } | null;
  mechanicReportedAt?: Date | null;
  requestedAt: Date;
  reports?: { submittedAt: Date }[];
};

async function approveNextStep(
  workOrder: ApprovalWorkOrder,
  user: { id: string; name: string; roles: RoleCode[] },
  memo?: string
) {
  const line = await resolveApprovalLine(workOrder);
  const mechanic = line.find((step) => step.role === "MECHANIC");
  if (mechanic && (workOrder.mechanicReportedAt || workOrder.reports?.length)) {
    mechanic.status = "APPROVED";
    mechanic.approvedAt = workOrder.mechanicReportedAt?.toISOString() ?? workOrder.reports?.[0]?.submittedAt.toISOString() ?? mechanic.approvedAt ?? new Date().toISOString();
    mechanic.approvedById = workOrder.assignedMechanic?.id ?? mechanic.approverId;
    mechanic.approvedByName = workOrder.assignedMechanic?.name ?? mechanic.approverName;
  }
  unlockApprovalLine(line);
  const step = line.find((item) => item.status === "PENDING" && item.role !== "MECHANIC");
  if (!step) throw new ApiError(409, "승인할 결재 단계가 없습니다.");
  if (!canApproveStep(step, user)) throw new ApiError(403, "현재 결재 단계의 승인자가 아닙니다.");
  step.status = "APPROVED";
  step.approvedAt = new Date().toISOString();
  step.approvedById = user.id;
  step.approvedByName = user.name;
  step.memo = memo ?? step.memo;
  unlockApprovalLine(line);
  return line;
}

async function resolveApprovalLine(workOrder: ApprovalWorkOrder): Promise<ApprovalStep[]> {
  const existing = parseApprovalLine(workOrder.approvalLine);
  if (existing.length) return existing;
  const [admin, executive] = await Promise.all([
    prisma.user.findFirst({
      where: { isActive: true, OR: [{ loginId: "ko.ms" }, { roles: { some: { role: { code: RoleCode.SUPER_ADMIN } } } }] },
      orderBy: { loginId: "asc" }
    }),
    prisma.user.findFirst({
      where: { isActive: true, OR: [{ loginId: "kim.ms" }, { roles: { some: { role: { code: RoleCode.EXECUTIVE } } } }] },
      orderBy: { loginId: "asc" }
    })
  ]);
  const mechanicDone = Boolean(workOrder.mechanicReportedAt || workOrder.reports?.length);
  return [
    {
      id: "mechanic-report",
      role: "MECHANIC",
      label: "정비사 완료보고",
      approverId: workOrder.assignedMechanic?.id,
      approverName: workOrder.assignedMechanic?.name ?? "미배정",
      approverTitle: workOrder.assignedMechanic?.title,
      status: mechanicDone ? "APPROVED" : "PENDING",
      requestedAt: workOrder.requestedAt.toISOString(),
      approvedAt: workOrder.mechanicReportedAt?.toISOString() ?? workOrder.reports?.[0]?.submittedAt.toISOString() ?? null
    },
    {
      id: "admin-approval",
      role: "ADMIN",
      label: "관리자 승인",
      approverId: admin?.id,
      approverName: admin ? `${admin.name} ${admin.title ?? ""}`.trim() : "고민서 책임",
      approverTitle: admin?.title,
      status: mechanicDone ? "PENDING" : "NOT_STARTED",
      requestedAt: workOrder.mechanicReportedAt?.toISOString() ?? null
    },
    {
      id: "executive-approval",
      role: "EXECUTIVE",
      label: "임원 최종승인",
      approverId: executive?.id,
      approverName: executive ? `${executive.name} ${executive.title ?? ""}`.trim() : "김민식 전무",
      approverTitle: executive?.title,
      status: "NOT_STARTED"
    }
  ];
}

function parseApprovalLine(value: Prisma.JsonValue | null): ApprovalStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isApprovalStep);
}

function isApprovalStep(value: unknown): value is ApprovalStep {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ApprovalStep>;
  return typeof item.id === "string" && typeof item.role === "string" && typeof item.status === "string";
}

function unlockApprovalLine(line: ApprovalStep[]) {
  const mechanic = line.find((item) => item.role === "MECHANIC");
  const admin = line.find((item) => item.role === "ADMIN");
  const executive = line.find((item) => item.role === "EXECUTIVE");
  if (admin?.status === "NOT_STARTED" && mechanic?.status === "APPROVED") {
    admin.status = "PENDING";
    admin.requestedAt = mechanic.approvedAt ?? new Date().toISOString();
  }
  if (executive?.status === "NOT_STARTED" && admin?.status === "APPROVED") {
    executive.status = "PENDING";
    executive.requestedAt = admin.approvedAt ?? new Date().toISOString();
  }
}

function canApproveStep(step: ApprovalStep, user: { id: string; roles: RoleCode[] }) {
  if (user.roles.includes(RoleCode.SUPER_ADMIN)) return true;
  if (step.approverId && step.approverId !== user.id) return false;
  if (step.role === "ADMIN") return user.roles.includes(RoleCode.ADMIN);
  if (step.role === "EXECUTIVE") return user.roles.includes(RoleCode.EXECUTIVE);
  return false;
}
