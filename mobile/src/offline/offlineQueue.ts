import * as SQLite from "expo-sqlite";
import { apiRequest, getMobileDeviceId } from "../api/client";

export type OfflineOperationType = "WORK_ORDER_START" | "WORK_ORDER_REPORT";

export type OfflineQueueItem = {
  requestId: string;
  syncId: string;
  createdAt: string;
  deviceId: string;
  branchId?: string | null;
  type: OfflineOperationType;
  payload: Record<string, unknown>;
};

type OfflineQueueRow = {
  request_id: string;
  sync_id: string;
  created_at: string;
  device_id: string;
  branch_id: string | null;
  operation_type: OfflineOperationType;
  payload: string;
  status: "PENDING" | "FAILED" | "SYNCED";
  attempts: number;
  last_error: string | null;
};

type SyncResponse = {
  syncId: string;
  deviceId: string;
  accepted: number;
  processed: number;
  duplicates: number;
  failed: number;
  results: {
    requestId: string;
    syncId: string;
    deviceId: string;
    type: OfflineOperationType;
    status: "PROCESSED" | "DUPLICATE" | "FAILED";
    duplicate: boolean;
    error?: string;
  }[];
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function initializeOfflineDb() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_requests (
      request_id TEXT PRIMARY KEY NOT NULL,
      sync_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      branch_id TEXT,
      operation_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS offline_requests_status_created_idx
      ON offline_requests(status, created_at);
  `);
}

export async function enqueueOfflineOperation(input: {
  type: OfflineOperationType;
  payload: Record<string, unknown>;
  branchId?: string | null;
  requestId?: string;
}) {
  await initializeOfflineDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const row: OfflineQueueItem = {
    requestId: input.requestId ?? makeId("req"),
    syncId: makeId("sync"),
    createdAt: now,
    deviceId: await getMobileDeviceId(),
    branchId: input.branchId ?? null,
    type: input.type,
    payload: input.payload
  };

  await db.runAsync(
    `INSERT OR IGNORE INTO offline_requests
      (request_id, sync_id, created_at, device_id, branch_id, operation_type, payload, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    row.requestId,
    row.syncId,
    row.createdAt,
    row.deviceId,
    row.branchId ?? null,
    row.type,
    JSON.stringify(row.payload)
  );
  return row;
}

export async function pendingOfflineCount() {
  await initializeOfflineDb();
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM offline_requests WHERE status IN ('PENDING', 'FAILED')"
  );
  return row?.count ?? 0;
}

export async function syncOfflineQueue() {
  await initializeOfflineDb();
  const db = await getDb();
  const rows = await db.getAllAsync<OfflineQueueRow>(
    `SELECT * FROM offline_requests
     WHERE status IN ('PENDING', 'FAILED')
     ORDER BY created_at ASC
     LIMIT 50`
  );
  if (!rows.length) return { synced: 0, failed: 0, duplicates: 0 };

  const syncId = makeId("sync");
  const operations = rows.map((row) => ({
    requestId: row.request_id,
    syncId: row.sync_id || syncId,
    createdAt: row.created_at,
    branchId: row.branch_id,
    type: row.operation_type,
    payload: safeJson(row.payload)
  }));

  const response = await apiRequest<SyncResponse>("/api/v1/sync", {
    method: "POST",
    body: JSON.stringify({ syncId, operations })
  });

  for (const result of response.results) {
    if (result.status === "PROCESSED" || result.status === "DUPLICATE") {
      await db.runAsync(
        "UPDATE offline_requests SET status = 'SYNCED', synced_at = ?, last_error = NULL WHERE request_id = ?",
        new Date().toISOString(),
        result.requestId
      );
    } else {
      await db.runAsync(
        "UPDATE offline_requests SET status = 'FAILED', attempts = attempts + 1, last_error = ? WHERE request_id = ?",
        result.error ?? "동기화 실패",
        result.requestId
      );
    }
  }

  return {
    synced: response.processed,
    duplicates: response.duplicates,
    failed: response.failed
  };
}

async function getDb() {
  dbPromise ??= SQLite.openDatabaseAsync("maintenance_offline.db");
  return dbPromise;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
