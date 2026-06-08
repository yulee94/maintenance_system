import ExcelJS from "exceljs";
import { format } from "date-fns";
import { WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { demoMechanicKpi, demoPriorityKpi, demoWorkOrders } from "@/lib/demo";

type ExportFilter = "all" | "pending" | "completed";

type ExportWorkOrder = {
  requestNo: string;
  requestDate: Date;
  customer: string;
  site: string;
  equipment: string;
  modelName: string;
  serialNo: string;
  faultDescription: string;
  mechanic: string;
  targetDueDate: Date | null;
  finalCompletedAt: Date | null;
  priority: string;
  status: string;
  actionTaken: string;
  diagnosisResult: string;
  memo: string;
  isDelayed: boolean;
};

const activeStatuses = new Set<WorkOrderStatus>([
  WorkOrderStatus.RECEIVED,
  WorkOrderStatus.UNASSIGNED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.REPORT_SUBMITTED,
  WorkOrderStatus.ADMIN_REVIEW,
  WorkOrderStatus.DELAYED,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TEMPORARY_ACTION,
  WorkOrderStatus.PART_WAITING,
  WorkOrderStatus.EQUIPMENT_IN_USE,
  WorkOrderStatus.REVISIT_REQUIRED
]);

const statusLabel: Record<string, string> = {
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

const priorityLabel: Record<string, string> = {
  P1: "긴급",
  P2: "중요",
  P3: "일반",
  OUTSOURCE: "외주",
  UNSET: "미지정"
};

export async function buildWorkOrderWorkbook(title: string, filter: ExportFilter = "all") {
  const rows = await getExportWorkOrders(filter);
  const workbook = new ExcelJS.Workbook();
  setupWorkbook(workbook);
  const sheet = workbook.addWorksheet(title);
  sheet.columns = workOrderColumns();
  styleHeader(sheet, "A1:P1");

  for (const row of rows) {
    sheet.addRow({
      requestNo: row.requestNo,
      requestDate: format(row.requestDate, "yyyy-MM-dd"),
      customer: row.customer,
      site: row.site,
      equipment: row.equipment,
      modelName: row.modelName,
      serialNo: row.serialNo,
      faultDescription: row.faultDescription,
      mechanic: row.mechanic,
      target: row.targetDueDate ? format(row.targetDueDate, "yyyy-MM-dd") : "",
      completed: row.finalCompletedAt ? format(row.finalCompletedAt, "yyyy-MM-dd") : "",
      priority: priorityLabel[row.priority] ?? row.priority,
      status: statusLabel[row.status] ?? row.status,
      actionTaken: row.actionTaken,
      diagnosisResult: row.diagnosisResult,
      memo: row.memo
    });
  }

  finishTable(sheet);
  return workbook;
}

export async function buildWorkDiaryWorkbook() {
  const rows = await getExportWorkOrders("all");
  const workbook = new ExcelJS.Workbook();
  setupWorkbook(workbook);
  const sheet = workbook.addWorksheet("업무일지");

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = "정비 업무일지";
  sheet.getCell("A1").font = { bold: true, size: 18 };
  sheet.getCell("A2").value = "작성부서";
  sheet.getCell("B2").value = "정비사업부";
  sheet.getCell("D2").value = "작성일자";
  sheet.getCell("E2").value = format(new Date(), "yyyy-MM-dd");
  sheet.addRow([]);
  sheet.addRow(["구분", "접수번호", "사업장", "차량/호기", "진행 내용", "담당"]);
  styleHeader(sheet, "A5:F5");

  for (const row of rows.slice(0, 50)) {
    sheet.addRow([
      statusLabel[row.status] ?? row.status,
      row.requestNo,
      row.customer,
      row.equipment,
      row.actionTaken || row.faultDescription,
      row.mechanic
    ]);
  }

  sheet.columns = [
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 16 },
    { width: 52 },
    { width: 14 }
  ];
  finishTable(sheet);
  return workbook;
}

export async function buildExecutiveReportWorkbook() {
  const rows = await getExportWorkOrders("all");
  const mechanicKpi = appEnv.demoMode ? demoMechanicKpi() : await buildDbMechanicKpiRows();
  const priorityKpi = appEnv.demoMode ? demoPriorityKpi() : await buildDbPriorityKpiRows();
  const workbook = new ExcelJS.Workbook();
  setupWorkbook(workbook);

  const report = workbook.addWorksheet("원페이지 보고");
  report.columns = [{ width: 20 }, { width: 18 }, { width: 28 }, { width: 48 }];
  report.mergeCells("A1:D1");
  report.getCell("A1").value = "정비 진행 현황 원페이지 보고";
  report.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF17201D" } };
  report.getCell("A2").value = "작성일";
  report.getCell("B2").value = format(new Date(), "yyyy-MM-dd HH:mm");

  const completed = rows.filter((row) => row.status === WorkOrderStatus.FINAL_COMPLETED).length;
  const pending = rows.filter((row) => row.status !== WorkOrderStatus.FINAL_COMPLETED).length;
  const delayed = rows.filter((row) => row.isDelayed || row.status === WorkOrderStatus.DELAYED).length;
  const urgent = rows.filter((row) => row.priority === "P1" && row.status !== WorkOrderStatus.FINAL_COMPLETED).length;
  const completionRate = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  report.addRow([]);
  report.addRow(["구분", "건수", "비율/상태", "비고"]);
  styleHeader(report, "A4:D4");
  report.addRow(["전체 접수", rows.length, "100%", "데모/운영 전체 정비건"]);
  report.addRow(["최종 완료", completed, `${completionRate}%`, "관리자 승인 기준"]);
  report.addRow(["미결", pending, "", "진행중, 보고 대기, 보류 포함"]);
  report.addRow(["지연", delayed, "", "Target 초과 또는 지연 상태"]);
  report.addRow(["긴급", urgent, "", "P1 미완료"]);

  report.addRow([]);
  report.addRow(["특이사항", "상태", "담당", "진행 내용"]);
  styleHeader(report, "A11:D11");
  for (const row of noteworthyRows(rows).slice(0, 8)) {
    report.addRow([
      `${row.requestNo} ${row.customer}`,
      `${priorityLabel[row.priority] ?? row.priority} / ${statusLabel[row.status] ?? row.status}`,
      row.mechanic || "미배정",
      row.actionTaken || row.diagnosisResult || row.faultDescription
    ]);
  }

  report.addRow([]);
  report.addRow(["관리 포인트", "", "", ""]);
  report.getCell(`A${report.rowCount}`).font = { bold: true };
  report.addRow(["1", "", "", "P1 긴급 미완료 건은 당일 target 기준으로 우선 배정/승인합니다."]);
  report.addRow(["2", "", "", "보고 대기 건은 관리자 최종 승인 전까지 KPI 완료로 반영하지 않습니다."]);
  report.addRow(["3", "", "", "지연 건은 target 변경 요청 사유와 부품/외주 일정을 함께 확인합니다."]);

  finishTable(report);

  const mechanicSheet = workbook.addWorksheet("정비사별 KPI");
  addRowsAsTable(mechanicSheet, mechanicKpi);
  const prioritySheet = workbook.addWorksheet("Priority별 KPI");
  addRowsAsTable(prioritySheet, priorityKpi);
  const detailSheet = workbook.addWorksheet("정비건 상세");
  detailSheet.columns = workOrderColumns();
  styleHeader(detailSheet, "A1:P1");
  for (const row of rows) {
    detailSheet.addRow({
      requestNo: row.requestNo,
      requestDate: format(row.requestDate, "yyyy-MM-dd"),
      customer: row.customer,
      site: row.site,
      equipment: row.equipment,
      modelName: row.modelName,
      serialNo: row.serialNo,
      faultDescription: row.faultDescription,
      mechanic: row.mechanic,
      target: row.targetDueDate ? format(row.targetDueDate, "yyyy-MM-dd") : "",
      completed: row.finalCompletedAt ? format(row.finalCompletedAt, "yyyy-MM-dd") : "",
      priority: priorityLabel[row.priority] ?? row.priority,
      status: statusLabel[row.status] ?? row.status,
      actionTaken: row.actionTaken,
      diagnosisResult: row.diagnosisResult,
      memo: row.memo
    });
  }
  finishTable(detailSheet);

  return workbook;
}

export async function workbookResponse(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    }
  });
}

async function getExportWorkOrders(filter: ExportFilter): Promise<ExportWorkOrder[]> {
  const rows = appEnv.demoMode ? demoRows() : await dbRows(filter);
  return applyExportFilter(rows, filter).sort((a, b) => {
    const requestDiff = b.requestDate.getTime() - a.requestDate.getTime();
    if (requestDiff) return requestDiff;
    return priorityOrder(a.priority) - priorityOrder(b.priority);
  });
}

function demoRows(): ExportWorkOrder[] {
  return demoWorkOrders().map((row) => ({
    requestNo: row.requestNo,
    requestDate: new Date(row.requestDate),
    customer: row.customer?.name ?? "",
    site: row.site?.name ?? "",
    equipment: row.equipmentInput ?? row.equipmentNoNormalized ?? "",
    modelName: row.equipment?.modelName ?? "",
    serialNo: row.equipment?.serialNo ?? "",
    faultDescription: row.faultDescription,
    mechanic: row.assignedMechanic?.name ?? "",
    targetDueDate: row.targetDueDate ? new Date(row.targetDueDate) : null,
    finalCompletedAt: row.finalCompletedAt ? new Date(row.finalCompletedAt) : null,
    priority: row.priorityLevel,
    status: row.status,
    actionTaken: row.actionTaken ?? "",
    diagnosisResult: row.diagnosisResult ?? "",
    memo: row.memo ?? "",
    isDelayed: Boolean(row.isDelayed)
  }));
}

async function dbRows(filter: ExportFilter): Promise<ExportWorkOrder[]> {
  const rows = await prisma.workOrder.findMany({
    where: {
      archivedAt: null,
      deletedAt: null,
      ...(filter === "pending" ? { status: { in: Array.from(activeStatuses) } } : {}),
      ...(filter === "completed" ? { status: WorkOrderStatus.FINAL_COMPLETED } : {})
    },
    include: { customer: true, site: true, equipment: true, assignedMechanic: true },
    orderBy: [{ requestDate: "desc" }, { priorityLevel: "asc" }]
  });

  return rows.map((row) => ({
    requestNo: row.requestNo,
    requestDate: row.requestDate,
    customer: row.customer?.name ?? "",
    site: row.site?.name ?? "",
    equipment: row.equipmentInput ?? row.equipmentNoNormalized ?? "",
    modelName: row.equipment?.modelName ?? "",
    serialNo: row.equipment?.serialNo ?? "",
    faultDescription: row.faultDescription,
    mechanic: row.assignedMechanic?.name ?? "",
    targetDueDate: row.targetDueDate,
    finalCompletedAt: row.finalCompletedAt,
    priority: row.priorityLevel,
    status: row.status,
    actionTaken: row.actionTaken ?? "",
    diagnosisResult: row.diagnosisResult ?? "",
    memo: row.memo ?? "",
    isDelayed: row.isDelayed
  }));
}

function applyExportFilter(rows: ExportWorkOrder[], filter: ExportFilter) {
  if (filter === "pending") return rows.filter((row) => activeStatuses.has(row.status as WorkOrderStatus));
  if (filter === "completed") return rows.filter((row) => row.status === WorkOrderStatus.FINAL_COMPLETED);
  return rows;
}

function workOrderColumns(): Partial<ExcelJS.Column>[] {
  return [
    { header: "접수번호", key: "requestNo", width: 16 },
    { header: "요청일자", key: "requestDate", width: 14 },
    { header: "사업장", key: "customer", width: 18 },
    { header: "위치", key: "site", width: 20 },
    { header: "차량/호기", key: "equipment", width: 16 },
    { header: "모델", key: "modelName", width: 16 },
    { header: "차대번호", key: "serialNo", width: 22 },
    { header: "불량내용", key: "faultDescription", width: 44 },
    { header: "정비사", key: "mechanic", width: 14 },
    { header: "Target", key: "target", width: 14 },
    { header: "완료일", key: "completed", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "상태", key: "status", width: 16 },
    { header: "조치내용", key: "actionTaken", width: 44 },
    { header: "진단결과", key: "diagnosisResult", width: 36 },
    { header: "비고", key: "memo", width: 24 }
  ];
}

function noteworthyRows(rows: ExportWorkOrder[]) {
  return rows.filter(
    (row) =>
      row.priority === "P1" ||
      row.status === WorkOrderStatus.DELAYED ||
      row.status === WorkOrderStatus.REPORT_SUBMITTED ||
      row.status === WorkOrderStatus.PART_WAITING ||
      row.status === WorkOrderStatus.ON_HOLD ||
      row.isDelayed
  );
}

async function buildDbMechanicKpiRows() {
  const { getMechanicKpi } = await import("@/lib/kpi");
  return getMechanicKpi();
}

async function buildDbPriorityKpiRows() {
  const { getPriorityKpi } = await import("@/lib/kpi");
  return getPriorityKpi();
}

function addRowsAsTable(sheet: ExcelJS.Worksheet, rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] ?? {});
  sheet.columns = keys.map((key) => ({ header: key, key, width: Math.max(14, key.length + 4) }));
  styleHeader(sheet, `A1:${String.fromCharCode(64 + Math.max(keys.length, 1))}1`);
  for (const row of rows) sheet.addRow(row);
  finishTable(sheet);
}

function setupWorkbook(workbook: ExcelJS.Workbook) {
  workbook.creator = "maintenance_system";
  workbook.created = new Date();
}

function styleHeader(sheet: ExcelJS.Worksheet, range: string) {
  const headerRow = sheet.getRow(Number(range.match(/\d+/)?.[0] ?? 1));
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6F5F" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  sheet.autoFilter = range;
}

function finishTable(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.eachRow((row) => {
    row.alignment = { vertical: "middle", wrapText: true };
  });
}

function priorityOrder(priority: string) {
  return { P1: 0, P2: 1, P3: 2, OUTSOURCE: 3, UNSET: 4 }[priority as "P1"] ?? 9;
}
