import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { mobileBranchesForUser } from "@/lib/mobile-api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const branches = await mobileBranchesForUser(user);
    return ok({
      apiVersion: "v1",
      branches,
      total: branches.length,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
