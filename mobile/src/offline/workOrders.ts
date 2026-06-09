import NetInfo from "@react-native-community/netinfo";
import { startWorkOrder, submitWorkReport } from "../api/client";
import type { ReportInput } from "../api/types";
import { enqueueOfflineOperation } from "./offlineQueue";

export type OfflineCapableResult<T> =
  | { queued: false; data: T }
  | { queued: true; requestId: string };

export async function startWorkOrderWithOffline(workOrderId: string, branchId?: string | null): Promise<OfflineCapableResult<unknown>> {
  if (!(await isOnline())) {
    const row = await enqueueOfflineOperation({
      type: "WORK_ORDER_START",
      branchId,
      payload: { workOrderId }
    });
    return { queued: true, requestId: row.requestId };
  }

  try {
    return { queued: false, data: await startWorkOrder(workOrderId) };
  } catch (error) {
    if (!isNetworkLikeError(error)) throw error;
    const row = await enqueueOfflineOperation({
      type: "WORK_ORDER_START",
      branchId,
      payload: { workOrderId }
    });
    return { queued: true, requestId: row.requestId };
  }
}

export async function submitWorkReportWithOffline(
  workOrderId: string,
  input: ReportInput,
  branchId?: string | null
): Promise<OfflineCapableResult<unknown>> {
  const payload = { workOrderId, ...input };
  if (!(await isOnline())) {
    const row = await enqueueOfflineOperation({
      type: "WORK_ORDER_REPORT",
      branchId,
      payload
    });
    return { queued: true, requestId: row.requestId };
  }

  try {
    return { queued: false, data: await submitWorkReport(workOrderId, input) };
  } catch (error) {
    if (!isNetworkLikeError(error)) throw error;
    const row = await enqueueOfflineOperation({
      type: "WORK_ORDER_REPORT",
      branchId,
      payload
    });
    return { queued: true, requestId: row.requestId };
  }
}

async function isOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

function isNetworkLikeError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("internet") ||
    message.includes("offline") ||
    message.includes("timeout")
  );
}
