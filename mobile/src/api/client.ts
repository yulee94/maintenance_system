import * as SecureStore from "expo-secure-store";
import type { AiResponse, AuthUser, Branch, LoginResponse, ReportInput, Summary, TaskBundle, WorkOrder } from "./types";
import { getApiBaseUrl } from "../config/environment";
import { getNativePushRegistration, type NativePushRegistration } from "../notifications/push";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

const TOKEN_KEY = "maintenance.mobile.sessionToken";
const DEVICE_ID_KEY = "maintenance.mobile.deviceId";
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

export async function login(loginId: string, password: string, otpCode?: string) {
  const data = await apiRequest<LoginResponse>("/api/v1/login", {
    method: "POST",
    body: JSON.stringify({ loginId, password, otpCode })
  });

  if (data.mfaRequired && !data.sessionToken) {
    throw new Error("OTP 또는 MFA 인증이 필요합니다. 모바일 MFA 화면에서 인증번호를 입력해야 합니다.");
  }

  if (!data.sessionToken) {
    throw new Error("모바일 로그인 토큰을 받지 못했습니다. 서버 버전을 확인하세요.");
  }

  await setSecureItem(TOKEN_KEY, data.sessionToken);
  try {
    await registerDevice(await getNativePushRegistration());
  } catch (error) {
    await deleteSecureItem(TOKEN_KEY);
    throw error;
  }
  return toAuthUser(data);
}

export async function logout() {
  await apiRequest<{ loggedOut: boolean }>("/api/v1/logout", { method: "POST" }).catch(() => undefined);
  await deleteSecureItem(TOKEN_KEY);
}

export async function getMe() {
  const data = await apiRequest<{ user: AuthUser | null }>("/api/v1/me");
  return data.user;
}

export async function getTaskBundle() {
  return apiRequest<TaskBundle>("/api/v1/tasks");
}

export async function getDashboardSummary(): Promise<Summary> {
  return (await getTaskBundle()).summary;
}

export async function getWorkOrders() {
  return (await getTaskBundle()).tasks;
}

export async function getBranches() {
  const data = await apiRequest<{ branches: Branch[] }>("/api/v1/branches");
  return data.branches;
}

export async function registerDevice(input: NativePushRegistration & { branchId?: string | null }) {
  return apiRequest<{
    device: {
      id?: string;
      userId: string;
      branchId?: string | null;
      deviceId: string;
      pushTokenStored: boolean;
      platform: string;
      appVersion?: string | null;
      lastActiveAt: string;
    };
  }>("/api/v1/devices/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function startWorkOrder(id: string) {
  return apiRequest<WorkOrder>(`/api/v1/tasks/${id}/start`, { method: "POST" });
}

export function submitWorkReport(id: string, input: ReportInput) {
  return apiRequest<{ report: { id: string }; workOrder: WorkOrder }>(`/api/v1/tasks/${id}/report`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export type ReportAttachmentUploadInput = {
  uri: string;
  name: string;
  mimeType: string;
  stage: "BEFORE" | "DURING" | "AFTER" | "REPORT";
};

export function uploadWorkReportAttachment(reportId: string, input: ReportAttachmentUploadInput) {
  const formData = new FormData();
  formData.append("reportId", reportId);
  formData.append("stage", input.stage);
  (formData as unknown as { append(name: string, value: unknown): void }).append("file", {
    uri: input.uri,
    name: input.name,
    type: input.mimeType
  });
  return apiRequest<{ id: string; mediaType: string; originalName: string }>("/api/v1/uploads/work-report", {
    method: "POST",
    body: formData
  });
}

export function askAi(question: string) {
  return apiRequest<AiResponse>("/api/v1/ai", {
    method: "POST",
    body: JSON.stringify({ question })
  });
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getSecureItem(TOKEN_KEY);
  const deviceId = await getDeviceId();
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
  return getApiBaseUrl();
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
  const saved = await getSecureItem(DEVICE_ID_KEY);
  if (saved) return saved;
  const id = `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await setSecureItem(DEVICE_ID_KEY, id);
  return id;
}

export function getMobileDeviceId() {
  return getDeviceId();
}

function getSecureItem(key: string) {
  return SecureStore.getItemAsync(key, secureStoreOptions);
}

function setSecureItem(key: string, value: string) {
  return SecureStore.setItemAsync(key, value, secureStoreOptions);
}

function deleteSecureItem(key: string) {
  return SecureStore.deleteItemAsync(key, secureStoreOptions);
}
