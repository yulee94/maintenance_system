import { NextRequest } from "next/server";
import { WorkOrderStatus, WorkResultType } from "@prisma/client";
import { z } from "zod";
import { auditLog } from "@/lib/audit";
import { ApiError, created, handleApiError, parseDateInput, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { demoSubmitReport } from "@/lib/demo";
import { appEnv } from "@/lib/env";
import { canAccessMobileTask, mobileTasksForUser, toMobileTask } from "@/lib/mobile-api";
import { workOrderInclude } from "@/lib/work-orders";

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

    if (appEnv.demoMode) {
      const visibleTask = (await mobileTasksForUser(user)).find((task) => task.id === id);
      if (!visibleTask) throw new ApiError(403, "이 정비건을 처리할 권한이 없습니다.");
      const result = await demoSubmitReport(id, input);
      return created({ report: result.report, workOrder: toMobileTask(result.workOrder) });
    }

    const before = await prisma.workOrder.findUnique({ where: { id } });
    if (!before || before.archivedAt || before.deletedAt) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
    if (!canAccessMobileTask(user, before.assignedMechanicId)) {
      throw new ApiError(403, "이 정비건을 처리할 권한이 없습니다.");
    }

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
        statusHistories: {
          create: {
            fromStatus: before.status,
            toStatus: WorkOrderStatus.REPORT_SUBMITTED,
            changedById: user.id,
            reason: "모바일 앱 완료보고 제출"
          }
        }
      },
      include: workOrderInclude
    });
    await auditLog({ user, request, action: "mobile.task.report", targetType: "workReport", targetId: report.id, before, after: row });
    return created({ report, workOrder: toMobileTask(row) });
  } catch (error) {
    return handleApiError(error);
  }
}
