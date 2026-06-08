import { NextRequest } from "next/server";
import { RoleCode } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { buildExecutiveReportWorkbook, workbookResponse } from "@/lib/exports";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request, [RoleCode.ADMIN, RoleCode.EXECUTIVE]);
    return workbookResponse(await buildExecutiveReportWorkbook(), "정비_원페이지_보고.xlsx");
  } catch (error) {
    return handleApiError(error);
  }
}
