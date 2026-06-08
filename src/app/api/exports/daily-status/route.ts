import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { buildWorkOrderWorkbook, workbookResponse } from "@/lib/exports";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    return workbookResponse(await buildWorkOrderWorkbook("일일업무진행현황"), "일일업무진행현황.xlsx");
  } catch (error) {
    return handleApiError(error);
  }
}
