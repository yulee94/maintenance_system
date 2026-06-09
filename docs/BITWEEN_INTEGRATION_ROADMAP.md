# Bitween/Payroll 통합 로드맵

이 문서는 `maintenance_system`을 향후 Bitween 급여 시스템, Bitween 휴대폰 출퇴근/근태 앱, 그룹웨어/전자결재 모듈과 합치거나 연결할 때 지켜야 할 기준입니다. 지금 시스템의 동작을 바꾸지는 않고, 서브 개발자가 같은 방향으로 확장할 수 있도록 계약과 경계를 먼저 고정합니다.

## 현재 판단

- 정비 렌탈 운영시스템은 Next.js/Prisma 기반이며 정비 접수, 배정, 완료보고, 결재라인, KPI, 엑셀 보고, 모바일 프리뷰를 담당합니다.
- Bitween은 급여 우선 플랫폼이며 Python/Tkinter 데스크톱 호환성을 유지하면서 Rust 백엔드와 TypeScript 프론트 계약으로 이동 중입니다.
- Bitween 모바일 근태 쪽은 `tenant_id`, 직원, 출퇴근 이벤트, 지오펜스, 생체인증 참조, 급여 집계 소스를 별도 도메인으로 관리합니다.
- 급여 API 계약은 `request_id`, `scope`, `input_type`, `tenant_id`, `metadata` 같은 안정적인 필드를 사용합니다.
- 따라서 정비 시스템은 급여 계산을 직접 포함하지 않고, 최종 승인된 정비 작업 시간과 증빙만 Bitween/payroll 쪽으로 전달해야 합니다.

## 소유권 원칙

| 도메인 | Source of truth | 정비 시스템에서의 사용 방식 |
| --- | --- | --- |
| 사용자/직원 신원 | Bitween 또는 통합 인증 | `employeeId`, `userId`, `loginId` 매핑만 보관 |
| 출퇴근/근태 | Bitween mobile attendance | 일정 배정용 가용 여부를 읽기 전용으로 조회 |
| 급여 계산 | Bitween payroll | 정비 작업 시간 증빙을 승인 후 export |
| 정비 접수/장비/수리 이력 | maintenance_system | 유사 고장 추천, 정비 KPI, 장비 이력의 기준 데이터 |
| 정비 완료 승인 | maintenance_system | 정비사 -> 고민서 책임 -> 김민식 전무 등 결재라인 유지 |
| 그룹웨어 문서/전자결재 | Bitween workflow | 장기적으로 정비 완료 승인과 문서 결재를 연결 |
| AI 권한 정책 | 각 서버의 권한 검사 | 프론트 숨김이 아니라 서버에서 역할별 차단 |

## 통합할 때 지켜야 할 경계

- 정비 시스템 DB에 급여액, 계좌, 주민번호, 급여 명세, 급여 산출 파일을 저장하지 않습니다.
- 정비사는 본인 작업, 정비 문의, 완료보고 작성 보조까지만 AI로 조회할 수 있습니다. KPI, 전체 성과, 급여, 계정/감사 자료는 관리자 이상 정책을 따릅니다.
- Bitween 근태 데이터는 정비 일정 배정 보조 자료로만 사용하고, 출퇴근 원본 이벤트를 정비 시스템에서 수정하지 않습니다.
- 정비 작업 시간은 급여 계산값이 아니라 `승인된 작업 증빙`으로 export합니다. 급여 반영 여부는 Bitween payroll이 결정합니다.
- 이름과 직책은 바뀔 수 있으므로 장기 연동 키는 `employeeId`, `externalUserId`, `tenantId`를 우선합니다.
- API 응답 필드는 Python, Rust, TypeScript에서 같은 의미로 유지합니다. alias가 필요하면 변환 어댑터에서 처리합니다.

## 역할 매핑 초안

| maintenance_system | 의미 | Bitween/통합 권한 매핑 |
| --- | --- | --- |
| `SUPER_ADMIN` | 최고 관리자, 권한/계정/감사 관리 | `admin`, tenant owner, workflow admin |
| `ADMIN` | 정비 운영 관리자, 배정/승인/KPI | workflow approver, operations manager |
| `EXECUTIVE` | 임원 보고/KPI 최종 판단 | executive report viewer, final approver |
| `MECHANIC` | 정비사, 본인 작업/완료보고 | field worker, attendance mobile user |
| `RECEPTIONIST` | 접수/고객 요청 등록 | requester, service desk |

역할명 자체는 각 시스템에서 다를 수 있으므로, 통합 계층에서는 `roles` 배열과 `allowedScopes`를 같이 내려주는 방식이 안전합니다.

## 공유 계약 필드

코드 레벨 초안은 `src/types/integration.ts`에 둡니다. 이후 실제 API를 붙일 때도 아래 필드는 가능한 유지합니다.

### 사용자/직원 신원

```json
{
  "tenantId": "coss",
  "userId": "maintenance-user-id",
  "employeeId": "bitween-employee-id",
  "externalUserId": "bitween-user-id",
  "loginId": "ko.ms",
  "displayName": "고민서",
  "title": "책임",
  "teamCode": "maintenance",
  "roles": ["SUPER_ADMIN", "ADMIN"],
  "isActive": true,
  "sourceSystem": "maintenance"
}
```

### 근태 가용성 조회

정비 일정 달력과 담당자 배정에서 사용할 읽기 전용 데이터입니다.

```json
{
  "tenantId": "coss",
  "employeeId": "emp-001",
  "workDate": "2026-06-09",
  "attendanceStatus": "WORKING",
  "clockInAt": "2026-06-09T00:00:00.000Z",
  "clockOutAt": null,
  "onLeave": false,
  "overtimeMinutes": 0,
  "sourceSystem": "bitween"
}
```

### 정비 작업 시간 export

최종 승인된 정비건만 Bitween payroll 쪽으로 넘깁니다.

```json
{
  "requestId": "maintenance-labor-2026-06-0001",
  "tenantId": "coss",
  "workOrderId": "wo-001",
  "requestNo": "MS-20260609-001",
  "mechanicEmployeeId": "emp-010",
  "startedAt": "2026-06-09T01:00:00.000Z",
  "reportedAt": "2026-06-09T03:00:00.000Z",
  "laborMinutes": 120,
  "approvalStatus": "FINAL_APPROVED",
  "payrollExportStatus": "READY",
  "sourceSystem": "maintenance"
}
```

## 권장 API 단계

1. `GET /api/integrations/bitween/users`
   - Bitween 직원/사용자와 정비 사용자 매핑을 조회합니다.
2. `GET /api/integrations/bitween/attendance/availability`
   - 기간별 출퇴근/휴가/근무 가능 상태를 읽습니다.
3. `POST /api/integrations/bitween/maintenance/labor-exports`
   - 최종 승인된 정비 작업 시간을 급여/근태 검토 후보로 보냅니다.
4. `POST /api/integrations/bitween/ai/policy-check`
   - AI 요청이 어떤 자료 범위를 볼 수 있는지 서버에서 판단합니다.
5. `GET /api/integrations/bitween/workflow/approval-lines`
   - 장기적으로 전자결재 결재선과 정비 완료 승인선을 동기화합니다.

## 단계별 진행안

| 단계 | 목표 | 구현 방향 |
| --- | --- | --- |
| Phase 1 | 계약 정렬 | 역할/직원/근태/작업시간 타입 확정, 문서화 |
| Phase 2 | 인증 연결 | SSO 또는 세션 브릿지, `employeeId` 매핑 테이블 추가 |
| Phase 3 | 근태 읽기 연동 | 정비 일정에서 휴가/근무 가능 상태 표시 |
| Phase 4 | 승인 기반 작업시간 export | 최종 완료 승인 후 Bitween payroll 검토 큐로 전송 |
| Phase 5 | 모바일 통합 셸 | 출퇴근/근태 탭과 정비팀 탭을 같은 앱 안에서 모듈화 |
| Phase 6 | AI 정책 통합 | 정비, 근태, 급여, 보고서 자료별 역할 차단 정책 통일 |

## 지금 코드에서 유지해야 할 결정

- `RoleCode` 값은 함부로 이름을 바꾸지 않습니다.
- 모바일 AI처럼 민감 자료 접근은 API 서버에서 최종 차단합니다.
- 결재라인은 사람 이름만이 아니라 `approverId`를 함께 유지합니다.
- 새 기능을 만들 때 직원 기준 필드는 `name`만 쓰지 말고 `employeeId` 또는 `externalUserId`를 추가할 수 있게 설계합니다.
- `tenantId`, `requestId`, `sourceSystem`, `metadata` 필드는 향후 외부 연동에서 공통 추적 키로 사용합니다.
- 로컬 업로드 파일, 실제 직원 명부, 급여 산출물, 세션, API 키는 GitHub에 올리지 않습니다.

## 주요 리스크

- 같은 직원이 시스템마다 다른 ID를 갖는 문제
- 급여/근태 개인정보가 정비 시스템에 과도하게 복제되는 문제
- 정비 작업 시간이 급여 산출값으로 오해되는 문제
- 역할명이 시스템별로 달라 AI 권한 차단이 틀어지는 문제
- 모바일 통합 시 출퇴근 탭과 정비 탭의 라우팅/세션 충돌
- 전자결재와 정비 완료 승인의 상태명이 달라지는 문제

## 다음 개발자가 바로 할 일

- `src/types/integration.ts`를 기준으로 실제 Bitween 어댑터 API payload를 맞춥니다.
- 사용자 관리 화면에 `employeeId`/외부 사용자 ID 매핑 필드를 추가하는 DB 마이그레이션을 별도 PR로 진행합니다.
- 일정 화면에 Bitween 근태 가용성 read model을 붙입니다.
- 최종 완료 승인 API에서 작업시간 export 후보를 생성하되, 실제 급여 반영은 Bitween payroll API에서 검증하게 합니다.
- AI 탭은 정비 자료, 보고서, KPI, 급여/근태 자료의 권한을 같은 정책 함수로 판정하게 정리합니다.
