import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  return ok({ apiVersion: "v1", user });
}
