import type { ApiEnvelope } from "@/types/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response as unknown as T;
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  if (!body.ok) throw new Error(body.error);
  return body.data;
}

export function postJson<T>(path: string, body: unknown) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function patchJson<T>(path: string, body: unknown) {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}
