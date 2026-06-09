import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true, data: { apiVersion: "v1", loggedOut: true } });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
