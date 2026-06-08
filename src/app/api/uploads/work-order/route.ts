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
    const workOrderId = String(formData.get("workOrderId") ?? "");
    const stage = String(formData.get("stage") ?? "REQUEST") as "REQUEST" | "BEFORE" | "DURING" | "AFTER";
    const file = formData.get("file");
    if (!workOrderId || !(file instanceof File)) throw new ApiError(422, "workOrderId and file are required.");
    const saved = await saveFormFile(file, `work-orders/${workOrderId}`);
    const row = await prisma.workOrderAttachment.create({
      data: { workOrderId, uploadedById: user.id, stage, ...saved }
    });
    await auditLog({ user, request, action: "upload.work_order", targetType: "workOrderAttachment", targetId: row.id, after: row });
    return created(row);
  } catch (error) {
    return handleApiError(error);
  }
}
