import { NextRequest } from "next/server";
import { WorkOrderStatus, WorkResultType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, created, handleApiError, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  resultType: z.nativeEnum(WorkResultType),
  diagnosisResult: z.string().min(1),
  actionTaken: z.string().min(1),
  incompleteReason: z.string().optional(),
  temporaryFollowupDueDate: z.string().optional(),
  temporaryFollowupContent: z.string().optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const input = await readJson(request, schema);
    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    const followupDate = parseDateInput(input.temporaryFollowupDueDate);
    const report = await prisma.workReport.create({
      data: {
        workOrderId: id,
        mechanicId: user.id,
        resultType: input.resultType,
        diagnosisResult: input.diagnosisResult,
        actionTaken: input.actionTaken,
        incompleteReason: input.incompleteReason,
        temporaryFollowupDueDate: followupDate,
        temporaryFollowupContent: input.temporaryFollowupContent
      }
    });
    const row = await prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.REPORT_SUBMITTED,
        mechanicReportedAt: new Date(),
        resultType: input.resultType,
        diagnosisResult: input.diagnosisResult,
        actionTaken: input.actionTaken,
        incompleteReason: input.incompleteReason,
        temporaryFollowupDueDate: followupDate,
        temporaryFollowupContent: input.temporaryFollowupContent,
        updatedById: user.id,
        statusHistories: { create: { fromStatus: before.status, toStatus: WorkOrderStatus.REPORT_SUBMITTED, changedById: user.id, reason: "완료보고 제출" } }
      }
    });
    await auditLog({ user, request, action: "work_order.report", targetType: "workReport", targetId: report.id, before, after: row });
    return created({ report, workOrder: row });
  } catch (error) {
    return handleApiError(error);
  }
}
