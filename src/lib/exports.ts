import ExcelJS from "exceljs";
import { format } from "date-fns";
import { prisma } from "@/lib/db";

export async function buildWorkOrderWorkbook(title: string, filter: "all" | "pending" | "completed" = "all") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "maintenance_system";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(title);
  sheet.columns = [
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
    { header: "Priority", key: "priority", width: 14 },
    { header: "상태", key: "status", width: 18 },
    { header: "조치내용", key: "actionTaken", width: 44 },
    { header: "비고", key: "memo", width: 24 }
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6F5F" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:O1";

  const rows = await prisma.workOrder.findMany({
    where: {
      archivedAt: null,
      deletedAt: null,
      ...(filter === "pending" ? { status: { notIn: ["FINAL_COMPLETED", "ARCHIVED", "CANCELLED"] } } : {}),
      ...(filter === "completed" ? { status: "FINAL_COMPLETED" } : {})
    },
    include: { customer: true, site: true, equipment: true, assignedMechanic: true },
    orderBy: [{ requestDate: "desc" }, { priorityLevel: "asc" }]
  });

  for (const row of rows) {
    sheet.addRow({
      requestNo: row.requestNo,
      requestDate: format(row.requestDate, "yyyy-MM-dd"),
      customer: row.customer?.name ?? "",
      site: row.site?.name ?? "",
      equipment: row.equipmentInput ?? row.equipmentNoNormalized ?? "",
      modelName: row.equipment?.modelName ?? "",
      serialNo: row.equipment?.serialNo ?? "",
      faultDescription: row.faultDescription,
      mechanic: row.assignedMechanic?.name ?? "",
      target: row.targetDueDate ? format(row.targetDueDate, "yyyy-MM-dd") : "",
      completed: row.finalCompletedAt ? format(row.finalCompletedAt, "yyyy-MM-dd") : "",
      priority: row.priorityLevel,
      status: row.status,
      actionTaken: row.actionTaken ?? "",
      memo: row.memo ?? ""
    });
  }

  sheet.eachRow((row) => {
    row.alignment = { vertical: "middle", wrapText: true };
  });
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
