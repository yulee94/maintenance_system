import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, handleApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { demoFindAttachmentByFileName } from "@/lib/demo";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const fileName = decodeURIComponent(id);
    if (appEnv.demoMode) {
      const attachment = await demoFindAttachmentByFileName(fileName);
      if (!attachment) throw new ApiError(404, "파일을 찾을 수 없습니다.");
      const bytes = await readFile(attachment.storagePath);
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Length": String(attachment.sizeBytes),
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
        }
      });
    }
    const attachment =
      (await prisma.workOrderAttachment.findFirst({ where: { fileName } })) ??
      (await prisma.workReportAttachment.findFirst({ where: { fileName } }));
    if (!attachment) throw new ApiError(404, "파일을 찾을 수 없습니다.");
    const bytes = await readFile(attachment.storagePath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(attachment.sizeBytes),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
