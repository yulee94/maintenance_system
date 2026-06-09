import ExcelJS from "exceljs";
import { format } from "date-fns";
import { WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appEnv } from "@/lib/env";
import { demoMechanicKpi, demoPriorityKpi, demoWorkOrders } from "@/lib/demo";
import { numberFromEquipmentText, pick, readMasterListRows } from "@/lib/excel";

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

type ExportEquipmentAsset = {
  assetNo: string;
  equipmentNo: string;
  placementNo: string;
  customer: string;
  site: string;
  modelName: string;
  serialNo: string;
  tonnage: string;
  status: string;
  managerName: string;
  location: string;
  operationType: string;
  operatingHours: string;
  workOrders: ExportWorkOrder[];
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
  const mechanicKpi = appEnv.demoMode ? await demoMechanicKpi() : await buildDbMechanicKpiRows();
  const priorityKpi = appEnv.demoMode ? await demoPriorityKpi() : await buildDbPriorityKpiRows();
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

export async function buildEquipmentHistoryWorkbook() {
  const assets = await getExportEquipmentAssets();
  const workbook = new ExcelJS.Workbook();
  setupWorkbook(workbook);

  const summary = workbook.addWorksheet("장비 판단 요약");
  summary.columns = equipmentSummaryColumns();
  styleHeader(summary, "A1:W1");

  for (const asset of assets) {
    const metrics = equipmentMetrics(asset.workOrders);
    const row = summary.addRow({
      assetNo: asset.assetNo,
      equipmentNo: asset.equipmentNo,
      placementNo: asset.placementNo,
      customer: asset.customer,
      site: asset.site,
      modelName: asset.modelName,
      serialNo: asset.serialNo,
      tonnage: asset.tonnage,
      status: asset.status,
      managerName: asset.managerName,
      location: asset.location,
      operationType: asset.operationType,
      operatingHours: asset.operatingHours,
      riskLevel: equipmentRiskLabel(metrics.riskLevel),
      recommendation: equipmentRecommendation(metrics.riskLevel),
      total: asset.workOrders.length,
      open: metrics.openCount,
      completed: metrics.completedCount,
      urgent: metrics.urgentCount,
      delayed: metrics.delayedCount,
      repeatSignal: metrics.repeatSignalCount,
      lastFault: asset.workOrders[0]?.faultDescription ?? "",
      lastAction: asset.workOrders[0]?.actionTaken || asset.workOrders[0]?.diagnosisResult || ""
    });
    styleRiskCell(row.getCell("riskLevel"), metrics.riskLevel);
  }
  finishTable(summary);

  const history = workbook.addWorksheet("장비별 정비 이력");
  history.columns = equipmentHistoryColumns();
  styleHeader(history, "A1:Q1");
  for (const asset of assets) {
    if (!asset.workOrders.length) {
      history.addRow({
        assetNo: asset.assetNo,
        riskLevel: equipmentRiskLabel(equipmentMetrics(asset.workOrders).riskLevel),
        customer: asset.customer,
        site: asset.site,
        modelName: asset.modelName,
        serialNo: asset.serialNo
      });
      continue;
    }
    const riskLevel = equipmentMetrics(asset.workOrders).riskLevel;
    for (const workOrder of asset.workOrders) {
      const row = history.addRow({
        assetNo: asset.assetNo,
        riskLevel: equipmentRiskLabel(riskLevel),
        customer: asset.customer,
        site: asset.site,
        modelName: asset.modelName,
        serialNo: asset.serialNo,
        requestNo: workOrder.requestNo,
        requestDate: format(workOrder.requestDate, "yyyy-MM-dd"),
        priority: priorityLabel[workOrder.priority] ?? workOrder.priority,
        status: statusLabel[workOrder.status] ?? workOrder.status,
        mechanic: workOrder.mechanic,
        target: workOrder.targetDueDate ? format(workOrder.targetDueDate, "yyyy-MM-dd") : "",
        completed: workOrder.finalCompletedAt ? format(workOrder.finalCompletedAt, "yyyy-MM-dd") : "",
        faultDescription: workOrder.faultDescription,
        actionTaken: workOrder.actionTaken,
        diagnosisResult: workOrder.diagnosisResult,
        memo: workOrder.memo
      });
      styleRiskCell(row.getCell("riskLevel"), riskLevel);
    }
  }
  finishTable(history);

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
  const rows = appEnv.demoMode ? await demoRows() : await dbRows(filter);
  return applyExportFilter(rows, filter).sort((a, b) => {
    const requestDiff = b.requestDate.getTime() - a.requestDate.getTime();
    if (requestDiff) return requestDiff;
    return priorityOrder(a.priority) - priorityOrder(b.priority);
  });
}

async function getExportEquipmentAssets(): Promise<ExportEquipmentAsset[]> {
  const rows = appEnv.demoMode ? await demoEquipmentExportRows() : await dbEquipmentExportRows();
  return rows.sort((a, b) => {
    const aMetrics = equipmentMetrics(a.workOrders);
    const bMetrics = equipmentMetrics(b.workOrders);
    const riskDiff = equipmentRiskOrder(aMetrics.riskLevel) - equipmentRiskOrder(bMetrics.riskLevel);
    if (riskDiff) return riskDiff;
    const countDiff = b.workOrders.length - a.workOrders.length;
    if (countDiff) return countDiff;
    return a.customer.localeCompare(b.customer, "ko") || a.assetNo.localeCompare(b.assetNo, "ko");
  });
}

async function demoEquipmentExportRows(): Promise<ExportEquipmentAsset[]> {
  const assets = new Map<string, ExportEquipmentAsset>();
  const masterRows = await readMasterListRows().catch(() => []);

  masterRows.forEach((row, index) => {
    const assetNo = numberFromEquipmentText(pick(row, ["K&L 등록", "No.", "배치No", "장비 No"])) || `template-${index + 1}`;
    assets.set(assetNo, {
      assetNo,
      equipmentNo: pick(row, ["장비 No"]),
      placementNo: pick(row, ["배치No"]),
      customer: pick(row, ["사업장", "계약처"]) || "미지정",
      site: pick(row, ["배치장소", "사업장"]) || "미지정",
      modelName: pick(row, ["모델명"]),
      serialNo: pick(row, ["차대번호"]),
      tonnage: pick(row, ["톤수"]),
      status: pick(row, ["상태"]),
      managerName: pick(row, ["담당자"]),
      location: pick(row, ["배치장소"]),
      operationType: pick(row, ["운영"]),
      operatingHours: pick(row, ["가동시간"]),
      workOrders: []
    });
  });

  for (const row of await demoRows()) {
    const assetNo = numberFromEquipmentText(row.equipment) || row.equipment || row.requestNo;
    const existing = assets.get(assetNo);
    if (existing) {
      existing.workOrders.push(row);
      continue;
    }
    assets.set(assetNo, {
      assetNo,
      equipmentNo: "",
      placementNo: "",
      customer: row.customer,
      site: row.site,
      modelName: row.modelName,
      serialNo: row.serialNo,
      tonnage: "",
      status: "",
      managerName: "",
      location: row.site,
      operationType: "",
      operatingHours: "",
      workOrders: [row]
    });
  }

  return Array.from(assets.values()).map((asset) => ({
    ...asset,
    workOrders: asset.workOrders.sort((a, b) => b.requestDate.getTime() - a.requestDate.getTime())
  }));
}

async function dbEquipmentExportRows(): Promise<ExportEquipmentAsset[]> {
  const rows = await prisma.equipment.findMany({
    include: {
      customer: true,
      site: true,
      workOrders: {
        where: { deletedAt: null },
        include: { customer: true, site: true, equipment: true, assignedMechanic: true },
        orderBy: { requestDate: "desc" }
      }
    },
    orderBy: [{ customer: { name: "asc" } }, { normalizedNo: "asc" }]
  });

  return rows.map((row) => ({
    assetNo: row.normalizedNo ?? row.equipmentNo ?? row.placementNo ?? row.serialNo ?? row.id,
    equipmentNo: row.equipmentNo ?? "",
    placementNo: row.placementNo ?? "",
    customer: row.customer?.name ?? "미지정",
    site: row.site?.name ?? row.location ?? "미지정",
    modelName: row.modelName ?? "",
    serialNo: row.serialNo ?? "",
    tonnage: row.tonnage ?? "",
    status: row.status ?? "",
    managerName: row.managerName ?? "",
    location: row.location ?? "",
    operationType: row.operationType ?? "",
    operatingHours: row.operatingHours ?? "",
    workOrders: row.workOrders.map((workOrder) => ({
      requestNo: workOrder.requestNo,
      requestDate: workOrder.requestDate,
      customer: workOrder.customer?.name ?? row.customer?.name ?? "",
      site: workOrder.site?.name ?? row.site?.name ?? "",
      equipment: workOrder.equipmentInput ?? workOrder.equipmentNoNormalized ?? row.normalizedNo ?? "",
      modelName: workOrder.equipment?.modelName ?? row.modelName ?? "",
      serialNo: workOrder.equipment?.serialNo ?? row.serialNo ?? "",
      faultDescription: workOrder.faultDescription,
      mechanic: workOrder.assignedMechanic?.name ?? "",
      targetDueDate: workOrder.targetDueDate,
      finalCompletedAt: workOrder.finalCompletedAt,
      priority: workOrder.priorityLevel,
      status: workOrder.status,
      actionTaken: workOrder.actionTaken ?? "",
      diagnosisResult: workOrder.diagnosisResult ?? "",
      memo: workOrder.memo ?? "",
      isDelayed: workOrder.isDelayed
    }))
  }));
}

async function demoRows(): Promise<ExportWorkOrder[]> {
  return (await demoWorkOrders()).map((row) => ({
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

function equipmentSummaryColumns(): Partial<ExcelJS.Column>[] {
  return [
    { header: "관리번호", key: "assetNo", width: 14 },
    { header: "장비 No", key: "equipmentNo", width: 16 },
    { header: "배치 No", key: "placementNo", width: 16 },
    { header: "사업장", key: "customer", width: 20 },
    { header: "배치장소", key: "site", width: 22 },
    { header: "모델명", key: "modelName", width: 18 },
    { header: "차대번호", key: "serialNo", width: 24 },
    { header: "톤수", key: "tonnage", width: 10 },
    { header: "상태", key: "status", width: 12 },
    { header: "담당자", key: "managerName", width: 14 },
    { header: "위치", key: "location", width: 22 },
    { header: "운영", key: "operationType", width: 12 },
    { header: "가동시간", key: "operatingHours", width: 12 },
    { header: "관리 판단", key: "riskLevel", width: 18 },
    { header: "권장 조치", key: "recommendation", width: 26 },
    { header: "누적 정비", key: "total", width: 12 },
    { header: "미결", key: "open", width: 10 },
    { header: "완료", key: "completed", width: 10 },
    { header: "긴급", key: "urgent", width: 10 },
    { header: "지연", key: "delayed", width: 10 },
    { header: "반복 신호", key: "repeatSignal", width: 12 },
    { header: "최근 불량", key: "lastFault", width: 42 },
    { header: "최근 조치", key: "lastAction", width: 42 }
  ];
}

function equipmentHistoryColumns(): Partial<ExcelJS.Column>[] {
  return [
    { header: "관리번호", key: "assetNo", width: 14 },
    { header: "관리 판단", key: "riskLevel", width: 18 },
    { header: "사업장", key: "customer", width: 20 },
    { header: "배치장소", key: "site", width: 22 },
    { header: "모델명", key: "modelName", width: 18 },
    { header: "차대번호", key: "serialNo", width: 24 },
    { header: "접수번호", key: "requestNo", width: 16 },
    { header: "접수일", key: "requestDate", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "상태", key: "status", width: 16 },
    { header: "정비사", key: "mechanic", width: 14 },
    { header: "Target", key: "target", width: 14 },
    { header: "완료일", key: "completed", width: 14 },
    { header: "불량내용", key: "faultDescription", width: 44 },
    { header: "조치내용", key: "actionTaken", width: 44 },
    { header: "진단결과", key: "diagnosisResult", width: 36 },
    { header: "비고", key: "memo", width: 24 }
  ];
}

function equipmentMetrics(workOrders: ExportWorkOrder[]) {
  const openCount = workOrders.filter((row) => !isClosedStatus(row.status)).length;
  const completedCount = workOrders.filter((row) => isClosedStatus(row.status)).length;
  const urgentCount = workOrders.filter((row) => row.priority === "P1").length;
  const delayedCount = workOrders.filter((row) => row.isDelayed || row.status === WorkOrderStatus.DELAYED).length;
  const repeatSignalCount = workOrders.filter((row) => /재발|반복|재방문|다시|또\s*/.test(row.faultDescription)).length;
  const riskLevel =
    workOrders.length >= 3 || repeatSignalCount >= 2 || (urgentCount > 0 && delayedCount > 0)
      ? "CRITICAL"
      : workOrders.length >= 2 || repeatSignalCount > 0 || urgentCount > 0 || delayedCount > 0 || openCount > 0
        ? "WATCH"
        : "NORMAL";
  return { openCount, completedCount, urgentCount, delayedCount, repeatSignalCount, riskLevel };
}

function isClosedStatus(status: string) {
  return ["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"].includes(status);
}

function equipmentRiskLabel(riskLevel: string) {
  if (riskLevel === "CRITICAL") return "교체/폐각 검토";
  if (riskLevel === "WATCH") return "정밀점검 대상";
  return "일반 관리";
}

function equipmentRecommendation(riskLevel: string) {
  if (riskLevel === "CRITICAL") return "교체/폐각 또는 대수선 검토";
  if (riskLevel === "WATCH") return "정밀점검 및 예방정비 강화";
  return "일반 관리";
}

function equipmentRiskOrder(riskLevel: string) {
  return { CRITICAL: 0, WATCH: 1, NORMAL: 2 }[riskLevel as "CRITICAL"] ?? 9;
}

function styleRiskCell(cell: ExcelJS.Cell, riskLevel: string) {
  const colors = {
    CRITICAL: "FFD93535",
    WATCH: "FFD49D12",
    NORMAL: "FF2F8B57"
  };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors[riskLevel as "CRITICAL"] ?? colors.NORMAL } };
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
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
