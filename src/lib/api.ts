import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export async function readJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json().catch(() => {
    throw new ApiError(400, "JSON body is required.");
  });
  return schema.parse(body);
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request.",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 422 }
    );
  }

  console.error(error);
  return NextResponse.json({ ok: false, error: "Unexpected server error." }, { status: 500 });
}

export function parseDateInput(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export function startOfLocalDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
