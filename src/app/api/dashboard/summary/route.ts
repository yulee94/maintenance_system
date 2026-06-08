import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleApiError, ok } from "@/lib/api";
import { getDashboardSummary } from "@/lib/kpi";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    return ok(await getDashboardSummary());
  } catch (error) {
    return handleApiError(error);
  }
}
