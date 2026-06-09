import type { WorkOrder } from "./api/types";

export const statusLabel: Record<string, string> = {
  RECEIVED: "접수",
  UNASSIGNED: "미배정",
  ASSIGNED: "배정",
  IN_PROGRESS: "작업중",
  REPORT_SUBMITTED: "보고 대기",
  ADMIN_REVIEW: "관리자 검토",
  FINAL_COMPLETED: "최종 완료",
  REJECTED: "반려",
  ON_HOLD: "보류",
  DELAYED: "지연",
  TEMPORARY_ACTION: "임시 조치",
  PART_WAITING: "부품 대기",
  EQUIPMENT_IN_USE: "장비 사용중",
  REVISIT_REQUIRED: "재방문 필요",
  ARCHIVED: "보관",
  CANCELLED: "취소"
};

export const priorityLabel: Record<WorkOrder["priorityLevel"], string> = {
  P1: "긴급",
  P2: "중요",
  P3: "일반",
  OUTSOURCE: "외주",
  UNSET: "미지정"
};

export function isClosed(row: WorkOrder) {
  return ["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"].includes(row.status);
}

export function isToday(row: WorkOrder) {
  const key = new Date().toISOString().slice(0, 10);
  const requestKey = row.requestDate?.slice(0, 10);
  const targetKey = row.targetDueDate?.slice(0, 10);
  return requestKey === key || targetKey === key || (!isClosed(row) && row.priorityLevel === "P1");
}

export function shortDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

export function siteName(row: WorkOrder) {
  return row.site?.name ?? row.customer?.name ?? "사업장 미지정";
}

export function equipmentName(row: WorkOrder) {
  return row.equipmentInput ?? row.equipmentNoNormalized ?? "장비 미지정";
}

export function sortWorkOrders(rows: WorkOrder[]) {
  const priorityRank: Record<WorkOrder["priorityLevel"], number> = { P1: 0, P2: 1, P3: 2, OUTSOURCE: 3, UNSET: 4 };
  return [...rows].sort(
    (a, b) =>
      priorityRank[a.priorityLevel] - priorityRank[b.priorityLevel] ||
      new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
  );
}
