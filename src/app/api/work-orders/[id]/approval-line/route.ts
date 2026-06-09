import { NextRequest } from "next/server";
import { Prisma, RoleCode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoSetApprovalLine } from "@/lib/demo";
import { workOrderInclude } from "@/lib/work-orders";

const schema = z.object({
  adminApproverId: z.string().optional(),
  executiveApproverId: z.string().optional()
});

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request, [RoleCode.ADMIN]);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    if (appEnv.demoMode) return ok(await demoSetApprovalLine(id, input));

    const row = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        assignedMechanic: { select: { id: true, name: true, title: true } },
        reports: { orderBy: { submittedAt: "desc" }, take: 1 }
      }
    });
    if (!row) throw new ApiError(404, "정비건을 찾을 수 없습니다.");

    const [admin, executive] = await Promise.all([
      findApprover(input.adminApproverId, RoleCode.ADMIN, "ko.ms"),
      findApprover(input.executiveApproverId, RoleCode.EXECUTIVE, "kim.ms")
    ]);
    const approvalLine = buildApprovalLine(row, admin, executive);
    const updated = await prisma.workOrder.update({
      where: { id },
      data: { approvalLine: approvalLine as unknown as Prisma.InputJsonValue },
      include: workOrderInclude
    });
    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

async function findApprover(id: string | undefined, role: RoleCode, fallbackLoginId: string) {
  if (id) {
    return prisma.user.findFirst({ where: { id, isActive: true } });
  }
  return (
    (await prisma.user.findFirst({ where: { isActive: true, loginId: fallbackLoginId } })) ??
    prisma.user.findFirst({
      where: { isActive: true, roles: { some: { role: { code: role } } } },
      orderBy: { loginId: "asc" }
    })
  );
}

function buildApprovalLine(
  row: {
    requestedAt: Date;
    mechanicReportedAt: Date | null;
    adminApprovedAt: Date | null;
    finalCompletedAt: Date | null;
    assignedMechanic?: { id: string; name: string; title?: string | null } | null;
    reports?: { submittedAt: Date }[];
  },
  admin: { id: string; name: string; title: string | null } | null,
  executive: { id: string; name: string; title: string | null } | null
): ApprovalStep[] {
  const mechanicDone = Boolean(row.mechanicReportedAt || row.reports?.length);
  const adminDone = Boolean(row.adminApprovedAt || row.finalCompletedAt);
  const finalDone = Boolean(row.finalCompletedAt);
  return [
    {
      id: "mechanic-report",
      role: "MECHANIC",
      label: "정비사 완료보고",
      approverId: row.assignedMechanic?.id,
      approverName: row.assignedMechanic?.name ?? "미배정",
      approverTitle: row.assignedMechanic?.title,
      status: mechanicDone ? "APPROVED" : "PENDING",
      requestedAt: row.requestedAt.toISOString(),
      approvedAt: row.mechanicReportedAt?.toISOString() ?? row.reports?.[0]?.submittedAt.toISOString() ?? null
    },
    {
      id: "admin-approval",
      role: "ADMIN",
      label: "관리자 승인",
      approverId: admin?.id,
      approverName: admin ? `${admin.name} ${admin.title ?? ""}`.trim() : "고민서 책임",
      approverTitle: admin?.title,
      status: adminDone ? "APPROVED" : mechanicDone ? "PENDING" : "NOT_STARTED",
      requestedAt: row.mechanicReportedAt?.toISOString() ?? null,
      approvedAt: row.adminApprovedAt?.toISOString() ?? null
    },
    {
      id: "executive-approval",
      role: "EXECUTIVE",
      label: "임원 최종승인",
      approverId: executive?.id,
      approverName: executive ? `${executive.name} ${executive.title ?? ""}`.trim() : "김민식 전무",
      approverTitle: executive?.title,
      status: finalDone ? "APPROVED" : adminDone ? "PENDING" : "NOT_STARTED",
      requestedAt: row.adminApprovedAt?.toISOString() ?? null,
      approvedAt: row.finalCompletedAt?.toISOString() ?? null
    }
  ];
}
