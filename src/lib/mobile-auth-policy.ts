import { createHash, randomUUID } from "crypto";
import { RoleCode } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";

export const mobileNeverStoreItems = [
  "비밀번호 원문",
  "주민등록번호",
  "카드번호",
  "민감정보 평문",
  "관리자 토큰 장기 저장"
];

export const mobileSecureStorageItems = [
  "짧은 만료 시간의 모바일 세션 토큰",
  "서버 등록용 기기 식별자",
  "앱 잠금/생체인증 설정값"
];

export function buildMobileAuthFlow(input: {
  user: AuthUser;
  mfaRequired: boolean;
  mfaVerified: boolean;
  deviceId?: string | null;
  deviceRegistrationRequired: boolean;
  branchCount: number;
}) {
  const deviceRegistered = Boolean(input.deviceId);
  return {
    steps: [
      {
        id: "company_account",
        label: "회사 계정 로그인",
        status: "completed"
      },
      {
        id: "mfa",
        label: "OTP 또는 MFA",
        status: input.mfaRequired ? (input.mfaVerified ? "completed" : "required") : "skipped",
        required: input.mfaRequired,
        methods: ["OTP", "MFA"]
      },
      {
        id: "device_registration",
        label: "기기 등록",
        status: input.deviceRegistrationRequired ? (deviceRegistered ? "completed" : "required") : "skipped",
        required: input.deviceRegistrationRequired
      },
      {
        id: "access_scope",
        label: "사업장/권한 확인",
        status: "completed",
        branchCount: input.branchCount,
        roles: input.user.roles
      },
      {
        id: "app_access",
        label: "앱 사용",
        status: input.mfaRequired && !input.mfaVerified ? "blocked" : "allowed"
      }
    ],
    accessScope: {
      branchCount: input.branchCount,
      roles: input.user.roles,
      scope: mobileAccessScope(input.user.roles)
    },
    device: {
      required: input.deviceRegistrationRequired,
      registered: deviceRegistered,
      deviceIdHash: input.deviceId ? hashDeviceId(input.deviceId) : null
    },
    storagePolicy: {
      secureStorageRequired: true,
      secureStorageTargets: ["iOS Keychain", "Android Keystore", "Secure Storage"],
      neverStore: mobileNeverStoreItems,
      secureStoreOnly: mobileSecureStorageItems
    }
  };
}

export function buildMfaChallenge(loginId: string) {
  return {
    mfaRequired: true,
    mfaChallengeId: randomUUID(),
    nextStep: "MFA",
    loginId,
    methods: ["OTP", "MFA"]
  };
}

export function hashDeviceId(deviceId: string) {
  return createHash("sha256").update(deviceId).digest("hex");
}

function mobileAccessScope(roles: RoleCode[]) {
  if (roles.includes(RoleCode.SUPER_ADMIN)) return "ALL_BRANCHES";
  if (roles.includes(RoleCode.EXECUTIVE)) return "REPORTING_BRANCHES";
  if (roles.includes(RoleCode.ADMIN) || roles.includes(RoleCode.RECEPTIONIST)) return "ASSIGNED_BRANCHES";
  return "OWN_TASKS";
}
