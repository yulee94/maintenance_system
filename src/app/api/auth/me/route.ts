import { NextRequest } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  return ok({ user });
}
