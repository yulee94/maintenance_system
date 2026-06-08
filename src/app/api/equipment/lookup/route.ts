import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ApiError, handleApiError, ok } from "@/lib/api";
import { findDuplicateCandidates, findEquipmentByKeyword, normalizeEquipmentKeyword } from "@/lib/work-orders";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const keyword = request.nextUrl.searchParams.get("keyword");
    if (!keyword) throw new ApiError(422, "keyword is required.");
    const equipment = await findEquipmentByKeyword(keyword);
    const normalized = equipment?.normalizedNo ?? normalizeEquipmentKeyword(keyword);
    const duplicates = await findDuplicateCandidates(normalized, "");
    return ok({ keyword, normalized, equipment, duplicateCandidates: duplicates });
  } catch (error) {
    return handleApiError(error);
  }
}
