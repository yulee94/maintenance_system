import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError, created, handleApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { saveFormFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const formData = await request.formData();
    const reportId = String(formData.get("reportId") ?? "");
    const stage = String(formData.get("stage") ?? "REPORT") as "REPORT" | "BEFORE" | "DURING" | "AFTER";
    const file = formData.get("file");
    if (!reportId || !(file instanceof File)) throw new ApiError(422, "reportId and file are required.");
    const saved = await saveFormFile(file, `reports/${reportId}`);
    const row = await prisma.workReportAttachment.create({
      data: { reportId, uploadedById: user.id, stage, ...saved }
    });
    await auditLog({ user, request, action: "upload.work_report", targetType: "workReportAttachment", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
