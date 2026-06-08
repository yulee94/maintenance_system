import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { workbookResponse } from "@/lib/exports";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("업무일지");
    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "업무일지";
    sheet.getCell("A1").font = { bold: true, size: 18 };
    sheet.getCell("A2").value = "작성부서";
    sheet.getCell("B2").value = "정비사업부";
    sheet.getCell("A3").value = "작성일자";
    sheet.getCell("B3").value = format(new Date(), "yyyy-MM-dd");
    sheet.addRow([]);
    sheet.addRow(["구분", "접수번호", "사업장", "차량", "내용", "담당"]);
    sheet.getRow(5).font = { bold: true };
    const rows = await prisma.workOrder.findMany({
      where: { archivedAt: null, deletedAt: null },
      include: { customer: true, assignedMechanic: true },
      orderBy: { updatedAt: "desc" },
      take: 50
    });
    for (const row of rows) {
      sheet.addRow([
        row.status,
        row.requestNo,
        row.customer?.name ?? "",
        row.equipmentInput ?? row.equipmentNoNormalized ?? "",
        row.actionTaken ?? row.faultDescription,
        row.assignedMechanic?.name ?? ""
      ]);
    }
    sheet.columns.forEach((column) => {
      column.width = 18;
    });
    sheet.getColumn(5).width = 48;
    return workbookResponse(workbook, "업무일지.xlsx");
  } catch (error) {
    return handleApiError(error);
  }
}
