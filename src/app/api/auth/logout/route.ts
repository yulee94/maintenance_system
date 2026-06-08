import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
