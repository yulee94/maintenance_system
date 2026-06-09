import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { buildEquipmentHistoryWorkbook, workbookResponse } from "@/lib/exports";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    return workbookResponse(await buildEquipmentHistoryWorkbook(), "장비별_정비이력.xlsx");
  } catch (error) {
    return handleApiError(error);
  }
}
