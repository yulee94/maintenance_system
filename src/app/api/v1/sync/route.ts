import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { processMobileSyncBatch } from "@/lib/mobile-sync";

const operationSchema = z.object({
  requestId: z.string().min(1),
  syncId: z.string().min(1).optional(),
  branchId: z.string().optional().nullable(),
  createdAt: z.string().min(1),
  type: z.enum(["WORK_ORDER_START", "WORK_ORDER_REPORT"]),
  payload: z.record(z.string(), z.unknown())
});

const schema = z.object({
  syncId: z.string().min(1),
  operations: z.array(operationSchema).min(1).max(100)
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const deviceId = request.headers.get("x-device-id");
    if (!deviceId) throw new ApiError(400, "device_id가 필요합니다.");
    const input = await readJson(request, schema);
    return ok(
      await processMobileSyncBatch({
        user,
        deviceId,
        syncId: input.syncId,
        operations: input.operations.map((operation) => ({
          ...operation,
          syncId: operation.syncId ?? input.syncId
        }))
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
