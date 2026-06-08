import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { buildWorkDiaryWorkbook, workbookResponse } from "@/lib/exports";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    return workbookResponse(await buildWorkDiaryWorkbook(), "업무일지.xlsx");
  } catch (error) {
    return handleApiError(error);
  }
}
