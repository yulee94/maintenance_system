import path from "node:path";
import ExcelJS from "exceljs";
import { appEnv } from "@/lib/env";

export const templateFiles = {
  masterList: "Master list_251120 현재.xlsx",
  dailyStatus: "6월5일 일일업무진행현황.xlsx",
  workDiary: "26.05.27업무일지.xlsx"
};

export type DailyStatusTemplateRow = {
  sourceRow: number;
  section: "completed-progress" | "pending";
  category: string;
  sequence: string;
  requestDate: string;
  customerName: string;
  equipmentInput: string;
  modelName: string;
  serialNo: string;
  faultDescription: string;
  mechanicName: string;
  targetDueDate: string;
  completedAt: string;
  actionTaken: string;
  memo: string;
  priorityText: string;
};

export function templatePath(fileName: string) {
  return path.join(appEnv.excelTemplateRoot, fileName);
}

export function getCellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if ("result" in value) return String(value.result ?? "");
  }
  return String(value).trim();
}

export async function readMasterListRows() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath(templateFiles.masterList));
  const worksheet = workbook.getWorksheet("K&L 지게차 Master list") ?? workbook.worksheets[0];
  if (!worksheet) return [];

  let headerRowNumber = 1;
  let headers: string[] = [];
  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as ExcelJS.CellValue[];
    const texts = values.map(getCellText);
    if (texts.some((text) => ["K&L 등록", "장비 No", "사업장", "모델명"].includes(text))) {
      headerRowNumber = rowNumber;
      headers = texts;
    }
  });

  if (!headers.length) {
    const row = worksheet.getRow(1);
    headers = (row.values as ExcelJS.CellValue[]).map(getCellText);
  }

  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const values = row.values as ExcelJS.CellValue[];
    const object: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      object[header] = getCellText(values[index]);
    });
    if (Object.values(object).some(Boolean)) rows.push(object);
  });
  return rows;
}

export async function readDailyStatusRows(): Promise<DailyStatusTemplateRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath(templateFiles.dailyStatus));
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  let section: DailyStatusTemplateRow["section"] = "completed-progress";
  const rows: DailyStatusTemplateRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values as ExcelJS.CellValue[];
    const texts = Array.from({ length: 13 }, (_, index) => getCellText(values[index + 1]));
    if (texts[0] === "구분" && texts[1] === "No.") {
      section = texts[11] === "비고" || texts[12] === "Status" ? "pending" : "completed-progress";
      return;
    }
    if (!["미", "추"].includes(texts[0]) || !texts[2] || !texts[3] || !texts[7]) return;

    rows.push({
      sourceRow: rowNumber,
      section,
      category: texts[0],
      sequence: texts[1],
      requestDate: texts[2],
      customerName: texts[3],
      equipmentInput: texts[4],
      modelName: texts[5],
      serialNo: texts[6],
      faultDescription: texts[7],
      mechanicName: texts[8],
      targetDueDate: texts[9],
      completedAt: texts[10],
      actionTaken: section === "pending" ? "" : texts[11],
      memo: section === "pending" ? texts[11] : "",
      priorityText: texts[12]
    });
  });

  return rows;
}

export function pick(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (value) return value;
  }
  return "";
}

export function numberFromEquipmentText(value: string) {
  return value.match(/\d+/)?.[0] ?? "";
}
