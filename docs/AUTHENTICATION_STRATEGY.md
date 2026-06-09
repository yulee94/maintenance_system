# Authentication Strategy

이 문서는 정비 렌탈 운영 시스템, 모바일 앱, 향후 Bitween/payroll 통합에서 사용할 로그인/인증 설계 기준입니다. 현재 구현은 아이디/비밀번호와 JWT 쿠키 세션을 사용합니다. 이후 운영 규모가 커질 때 아래 인증 방식을 단계적으로 추가합니다.

## 인증 방식 추천 기준

| 방식 | 추천 상황 | 설계 방향 |
| --- | --- | --- |
| 회사 SSO | 직원 수가 많고 조직 관리가 필요한 경우 | OIDC 또는 SAML 기반 SSO를 우선 검토하고, `employeeId`, `tenantId`, `branch_id` 권한을 내부 사용자와 매핑 |
| 이메일/휴대폰 로그인 | 일반적인 SaaS형 플랫폼 | 외부 협력사, 일반 운영 사용자, SSO가 없는 고객사 계정에 사용 |
| OTP/MFA | 관리자, 민감정보 접근자 | 본사 최고관리자, 지역 관리자, 사업장 관리자, 임원, 계정/권한/감사/KPI 접근자에게 필수 적용 |
| 생체인증 | 모바일 앱 편의성 강화 | 모바일 앱 잠금 해제와 재인증에 사용하되, 생체정보 원본은 서버에 저장하지 않음 |

## 기본 원칙

1. 인증(authentication)과 권한(authorization)을 분리합니다.
2. 로그인 방식이 달라도 최종 권한은 서버에서 role, `branch_id`, 권역, 협력사 scope를 기준으로 다시 판단합니다.
3. 회사 SSO를 도입해도 기존 아이디/비밀번호 계정은 전환 기간 동안 유지할 수 있습니다.
4. 관리자와 민감정보 접근자는 로그인 방식과 관계없이 MFA를 요구합니다.
5. 모바일 생체인증은 편의 기능이며, 서버 권한 검사를 대체하지 않습니다.
6. `prod`에는 테스트 계정 자동 로그인, 더미 인증 우회, 디버그 인증 메뉴를 넣지 않습니다.

## 사용자 유형별 인증 정책

| 사용자 유형 | 기본 로그인 | 추가 인증 | 비고 |
| --- | --- | --- | --- |
| 본사 최고관리자 | 회사 SSO 또는 관리자 전용 계정 | MFA 필수 | 전체 사업장, 권한, 감사 로그 접근 |
| 지역 관리자 | 회사 SSO | MFA 필수 | 담당 권역 내 여러 `branch_id` 접근 |
| 사업장 관리자 | 회사 SSO 또는 이메일/휴대폰 | MFA 권장, 민감 기능은 필수 | 자기 사업장 관리 |
| 직원/정비사 | 회사 SSO 또는 휴대폰/아이디 로그인 | 모바일 생체인증 권장 | 자기 업무와 배정 작업 중심 |
| 외부 협력사 | 이메일/휴대폰 로그인 | 업무 위험도에 따라 OTP | 지정 기능과 지정 작업만 접근 |
| 임원/본사 조회자 | 회사 SSO | MFA 필수 | KPI, 보고서, 전체 조회 접근 |

## SSO 설계

SSO는 직원 수가 늘고 조직/퇴사/부서 이동 관리가 중요해질 때 우선 도입합니다.

권장 방식:

- OIDC를 우선 검토합니다.
- 기존 그룹웨어나 인사 시스템이 SAML만 지원하면 SAML도 허용합니다.
- SSO provider의 사용자 식별자는 내부 `User`와 직접 섞지 않고 별도 identity 테이블로 매핑합니다.
- SSO 로그인 후에도 `UserBranch`, `Region`, role 정보를 서버 DB에서 다시 조회합니다.

권장 매핑 필드:

```text
tenantId
employeeId
externalUserId
provider
providerSubject
email
phone
branch_id
```

## 이메일/휴대폰 로그인

이메일/휴대폰 로그인은 SaaS형 플랫폼과 외부 협력사 계정에 적합합니다.

운영 기준:

- 이메일과 휴대폰은 검증된 값만 로그인 식별자로 사용합니다.
- 휴대폰 OTP는 편리하지만 SIM swap 위험이 있으므로 관리자 MFA의 유일한 수단으로 쓰지 않습니다.
- 외부 협력사는 계정 생성 시 접근 가능한 기능, 작업, 사업장, 만료일을 함께 지정합니다.
- 퇴사자, 계약 종료 협력사, 장기 미사용 계정은 자동 비활성화 기준을 둡니다.

## OTP/MFA

관리자와 민감정보 접근자는 MFA를 필수로 둡니다.

MFA 필수 대상:

- 본사 최고관리자
- 지역 관리자
- 사업장 관리자 중 계정/권한/승인/KPI 접근자
- 임원/본사 조회자
- DB, 배포, 운영 콘솔 접근자

권장 우선순위:

1. WebAuthn/passkey 또는 보안키
2. TOTP 인증 앱
3. 이메일 OTP
4. SMS OTP

SMS OTP는 보조 수단으로만 사용하고, 계정/권한/감사/급여/민감정보 접근에는 더 강한 MFA를 우선합니다.

## 모바일 생체인증

모바일 앱에서는 Face ID, Touch ID, Android biometric 같은 OS 생체인증을 편의 기능으로 사용합니다.

운영 기준:

- 생체정보 원본은 서버에 저장하지 않습니다.
- 서버에는 기기 식별자, refresh token, 마지막 인증 시각, 폐기 여부 같은 메타데이터만 저장합니다.
- 앱 재실행, 현장 작업 재개, 완료보고 승인 직전 같은 지점에서 생체 재인증을 사용할 수 있습니다.
- 기기 분실, 퇴사, 협력사 계약 종료 시 해당 기기의 refresh token을 폐기합니다.
- 생체인증 성공 후에도 API 서버는 role과 `branch_id` scope를 다시 검사합니다.

## 권장 데이터 모델 초안

실제 적용은 별도 Prisma migration으로 진행합니다.

```prisma
model AuthIdentity {
  id              String   @id @default(cuid())
  userId          String
  provider        String
  providerSubject String
  email           String?
  phone           String?
  verifiedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([provider, providerSubject])
  @@index([userId])
}

model MfaFactor {
  id         String    @id @default(cuid())
  userId     String
  type       String
  label      String?
  isActive   Boolean   @default(true)
  verifiedAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([userId, isActive])
}

model TrustedDevice {
  id           String    @id @default(cuid())
  userId       String
  deviceName   String?
  deviceType   String?
  lastUsedAt   DateTime?
  revokedAt    DateTime?
  createdAt    DateTime  @default(now())

  @@index([userId, revokedAt])
}

model LoginAudit {
  id        String   @id @default(cuid())
  userId    String?
  loginId   String?
  provider  String?
  ipAddress String?
  userAgent String?
  result    String
  reason    String?
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([result, createdAt])
}
```

## 단계별 적용 순서

1. 현재 아이디/비밀번호 로그인과 JWT 세션을 유지한다.
2. 로그인 감사 로그를 보강한다.
3. 관리자 계정부터 MFA를 추가한다.
4. 이메일/휴대폰 검증 로그인과 계정 복구 흐름을 추가한다.
5. 모바일 앱에 생체인증 기반 재인증과 기기 관리 기능을 추가한다.
6. 직원 수와 조직 관리 요구가 커지는 시점에 회사 SSO를 연결한다.
7. SSO 연결 후에도 `UserBranch`, role, 협력사 scope는 내부 DB에서 최종 판단한다.

## 현재 적용 범위

이번 문서는 향후 인증 설계 기준을 고정하기 위한 문서입니다. 현재 변경에서는 실제 로그인 API, Prisma schema, 세션 로직, 모바일 앱 코드는 수정하지 않습니다.
