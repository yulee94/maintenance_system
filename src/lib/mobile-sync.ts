import { Prisma, WorkOrderStatus, WorkResultType } from "@prisma/client";
import { z } from "zod";
import type { AuthUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  demoStartWorkOrder,
  demoSubmitReport
} from "@/lib/demo";
import { appEnv } from "@/lib/env";
import { hashDeviceId } from "@/lib/mobile-auth-policy";
import { canAccessMobileTask, toMobileTask } from "@/lib/mobile-api";
import { workOrderInclude } from "@/lib/work-orders";

export const mobileSyncOperationTypes = ["WORK_ORDER_START", "WORK_ORDER_REPORT"] as const;
export type MobileSyncOperationType = (typeof mobileSyncOperationTypes)[number];

export type MobileSyncOperationInput = {
  requestId: string;
  syncId: string;
  branchId?: string | null;
  createdAt: string;
  type: MobileSyncOperationType;
  payload: Record<string, unknown>;
};

type MobileSyncResult = {
  requestId: string;
  syncId: string;
  deviceId: string;
  type: MobileSyncOperationType;
  status: "PROCESSED" | "DUPLICATE" | "FAILED";
  duplicate: boolean;
  result?: unknown;
  error?: string;
};

const reportSchema = z.object({
  workOrderId: z.string().min(1),
  resultType: z.nativeEnum(WorkResultType),
  diagnosisResult: z.string().min(1),
  actionTaken: z.string().min(1),
  incompleteReason: z.string().optional(),
  temporaryFollowupDueDate: z.string().optional(),
  temporaryFollowupContent: z.string().optional()
});

const demoSyncResults = new Map<string, MobileSyncResult>();

export async function processMobileSyncBatch(input: {
  user: AuthUser;
  deviceId: string;
  syncId: string;
  operations: MobileSyncOperationInput[];
}) {
  const deviceIdHash = hashDeviceId(input.deviceId);
  const results: MobileSyncResult[] = [];
  for (const operation of input.operations) {
    results.push(await processMobileSyncOperation(input.user, deviceIdHash, input.syncId, operation));
  }
  return {
    syncId: input.syncId,
    deviceId: deviceIdHash,
    accepted: results.length,
    processed: results.filter((row) => row.status === "PROCESSED").length,
    duplicates: results.filter((row) => row.duplicate).length,
    failed: results.filter((row) => row.status === "FAILED").length,
    results
  };
}

async function processMobileSyncOperation(
  user: AuthUser,
  deviceId: string,
  batchSyncId: string,
  operation: MobileSyncOperationInput
): Promise<MobileSyncResult> {
  const syncId = operation.syncId || batchSyncId;
  const key = `${deviceId}:${operation.requestId}`;

  if (appEnv.demoMode) {
    const duplicate = demoSyncResults.get(key);
    if (duplicate) return { ...duplicate, status: "DUPLICATE", duplicate: true };
    try {
      const result = await applyOperation(user, operation);
      const row: MobileSyncResult = {
        requestId: operation.requestId,
        syncId,
        deviceId,
        type: operation.type,
        status: "PROCESSED",
        duplicate: false,
        result
      };
      demoSyncResults.set(key, row);
      return row;
    } catch (error) {
      const row: MobileSyncResult = {
        requestId: operation.requestId,
        syncId,
        deviceId,
        type: operation.type,
        status: "FAILED",
        duplicate: false,
        error: error instanceof Error ? error.message : "동기화 처리에 실패했습니다."
      };
      demoSyncResults.set(key, row);
      return row;
    }
  }

  let createdRecordId: string | null = null;
  try {
    const record = await prisma.offlineSyncRequest.create({
      data: {
        requestId: operation.requestId,
        syncId,
        userId: user.id,
        branchId: operation.branchId ?? null,
        deviceId,
        operationType: operation.type,
        payload: operation.payload as Prisma.InputJsonValue,
        status: "RECEIVED",
        createdAt: parseClientDate(operation.createdAt)
      }
    });
    createdRecordId = record.id;
  } catch (error) {
    if (isUniqueRequestConflict(error)) {
      const duplicate = await prisma.offlineSyncRequest.findUnique({
        where: { deviceId_requestId: { deviceId, requestId: operation.requestId } }
      });
      return {
        requestId: operation.requestId,
        syncId: duplicate?.syncId ?? syncId,
        deviceId,
        type: operation.type,
        status: "DUPLICATE",
        duplicate: true,
        result: duplicate?.result ?? undefined,
        error: duplicate?.error ?? undefined
      };
    }
    throw error;
  }

  try {
    const result = await applyOperation(user, operation);
    await prisma.offlineSyncRequest.update({
      where: { id: createdRecordId },
      data: {
        status: "PROCESSED",
        result: toJson(result),
        processedAt: new Date()
      }
    });
    return {
      requestId: operation.requestId,
      syncId,
      deviceId,
      type: operation.type,
      status: "PROCESSED",
      duplicate: false,
      result
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "동기화 처리에 실패했습니다.";
    await prisma.offlineSyncRequest.update({
      where: { id: createdRecordId },
      data: {
        status: "FAILED",
        error: message,
        processedAt: new Date()
      }
    });
    return {
      requestId: operation.requestId,
      syncId,
      deviceId,
      type: operation.type,
      status: "FAILED",
      duplicate: false,
      error: message
    };
  }
}

async function applyOperation(user: AuthUser, operation: MobileSyncOperationInput) {
  if (operation.type === "WORK_ORDER_START") {
    return { workOrder: await applyWorkOrderStart(user, operation.payload) };
  }
  if (operation.type === "WORK_ORDER_REPORT") {
    return await applyWorkOrderReport(user, operation.payload);
  }
  throw new ApiError(422, "지원하지 않는 오프라인 동기화 작업입니다.");
}

async function applyWorkOrderStart(user: AuthUser, payload: Record<string, unknown>) {
  const workOrderId = stringPayload(payload, "workOrderId") ?? stringPayload(payload, "id");
  if (!workOrderId) throw new ApiError(422, "workOrderId가 필요합니다.");

  if (appEnv.demoMode) return toMobileTask(await demoStartWorkOrder(workOrderId));

  const before = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!before || before.archivedAt || before.deletedAt) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
  if (!canAccessMobileTask(user, before.assignedMechanicId)) {
    throw new ApiError(403, "이 정비건을 처리할 권한이 없습니다.");
  }
  const row = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: WorkOrderStatus.IN_PROGRESS,
      updatedById: user.id,
      statusHistories: {
        create: {
          fromStatus: before.status,
          toStatus: WorkOrderStatus.IN_PROGRESS,
          changedById: user.id,
          reason: "모바일 오프라인 동기화 작업 시작"
        }
      }
    },
    include: workOrderInclude
  });
  return toMobileTask(row);
}

async function applyWorkOrderReport(user: AuthUser, payload: Record<string, unknown>) {
  const input = reportSchema.parse(payload.report ?? payload);

  if (appEnv.demoMode) {
    const result = await demoSubmitReport(input.workOrderId, input);
    return { report: result.report, workOrder: toMobileTask(result.workOrder) };
  }

  const before = await prisma.workOrder.findUnique({ where: { id: input.workOrderId } });
  if (!before || before.archivedAt || before.deletedAt) throw new ApiError(404, "정비건을 찾을 수 없습니다.");
  if (!canAccessMobileTask(user, before.assignedMechanicId)) {
    throw new ApiError(403, "이 정비건을 처리할 권한이 없습니다.");
  }

  const followupDate = input.temporaryFollowupDueDate ? new Date(input.temporaryFollowupDueDate) : undefined;
  const report = await prisma.workReport.create({
    data: {
      workOrderId: input.workOrderId,
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
    where: { id: input.workOrderId },
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
          reason: "모바일 오프라인 동기화 완료보고 제출"
        }
      }
    },
    include: workOrderInclude
  });
  return { report, workOrder: toMobileTask(row) };
}

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseClientDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(422, "created_at 날짜 형식이 올바르지 않습니다.");
  return date;
}

function isUniqueRequestConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
