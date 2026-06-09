import * as SecureStore from "expo-secure-store";
import type { AiResponse, AuthUser, LoginResponse, ReportInput, Summary, WorkOrder } from "./types";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

const TOKEN_KEY = "maintenance.mobile.sessionToken";
const DEVICE_ID_KEY = "maintenance.mobile.deviceId";
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function login(loginId: string, password: string) {
  const data = await apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ loginId, password })
  });

  if (!data.sessionToken) {
    throw new Error("모바일 로그인 토큰을 받지 못했습니다. 서버가 최신 버전인지 확인하세요.");
  }

  await SecureStore.setItemAsync(TOKEN_KEY, data.sessionToken);
  return toAuthUser(data);
}

export async function logout() {
  await apiRequest<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getMe() {
  const data = await apiRequest<{ user: AuthUser | null }>("/api/auth/me");
  return data.user;
}

export function getDashboardSummary() {
  return apiRequest<Summary>("/api/dashboard/summary");
}

export function getWorkOrders() {
  return apiRequest<WorkOrder[]>("/api/work-orders");
}

export function startWorkOrder(id: string) {
  return apiRequest<WorkOrder>(`/api/work-orders/${id}/start`, { method: "POST" });
}

export function submitWorkReport(id: string, input: ReportInput) {
  return apiRequest<{ report: { id: string }; workOrder: WorkOrder }>(`/api/work-orders/${id}/report`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function askAi(question: string) {
  return apiRequest<AiResponse>("/api/mobile/ai", {
    method: "POST",
    body: JSON.stringify({ question })
  });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const deviceId = await getDeviceId();
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      "X-Client-Platform": "mobile",
      "X-Device-Id": deviceId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) throw new Error(`요청 실패: ${response.status}`);
    return response as T;
  }

  const body = (await response.json()) as ApiEnvelope<T>;
  if (!body.ok) throw new Error(body.error ?? "요청 처리에 실패했습니다.");
  return body.data;
}

export function apiBaseUrl() {
  return API_BASE_URL;
}

function toAuthUser(input: LoginResponse): AuthUser {
  return {
    id: input.id,
    loginId: input.loginId,
    name: input.name,
    roles: input.roles,
    mustChangePassword: input.mustChangePassword
  };
}

async function getDeviceId() {
  const saved = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (saved) return saved;
  const id = `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}
