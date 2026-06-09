# API 명세

모든 JSON API는 성공 시 `{ ok: true, data }`, 실패 시 `{ ok: false, error }` 형식을 사용한다. 엑셀 다운로드 API는 `.xlsx` 바이너리를 반환한다.

## API 네임스페이스

| 구분 | 경로 | 용도 |
| --- | --- | --- |
| Web Admin API | `/api/auth`, `/api/work-orders`, `/api/admin`, `/api/exports` | PC 관리자 웹, 임원 보고, 엑셀 다운로드 |
| Mobile App API | `/api/v1/*`, `/api/v2/*` | React Native iOS/Android 앱 |
| Public Customer API | `/api/public/v1/*` | 추후 고객사/외부 조회용 공개 API |
| Internal Admin API | `/api/internal/v1/*` | 추후 배치, 운영자 도구, 내부 연동 API |

웹 관리자 API와 모바일 앱 API는 분리한다. 모바일 앱은 반드시 버전이 있는 경로만 사용한다.

## Mobile App API v1

- `POST /api/v1/login`: 모바일 로그인, `sessionToken` 발급
- `POST /api/v1/logout`: 모바일 로그아웃
- `GET /api/v1/me`: 현재 모바일 사용자 조회
- `GET /api/v1/branches`: 접근 가능한 사업장 목록 조회
- `GET /api/v1/tasks`: 접근 가능한 정비건 목록 및 요약 조회
- `POST /api/v1/tasks/:id/start`: 모바일 작업 시작
- `POST /api/v1/tasks/:id/report`: 모바일 완료보고 제출
- `POST /api/v1/ai`: 모바일 AI 문의/보고서 작성 보조

모바일 앱 공통 헤더:

```text
X-Client-Platform: mobile
X-Device-Id: {device-id}
Authorization: Bearer {session-token}
```

정비사는 본인에게 배정된 정비건만 조회/처리한다. 관리자, 임원, 최고관리자는 현재 접근 가능한 운영 데이터 범위 안에서 전체 업무를 조회할 수 있다.

## Mobile App API v2

- `GET /api/v2/tasks`: v1 정비건 목록과 호환되며, `paging`, `features`, `links` 메타데이터를 추가 제공한다.

v2는 앱 기능 확장용이다. v1 앱이 운영 중일 때도 v2를 병행 배포해 앱 업데이트를 점진적으로 진행한다.

## Public Customer API v1

- `GET /api/public/v1/health`: 공개 고객 API 상태 확인

고객사 포털, 외부 조회, 제한된 고객용 정비현황 공개가 필요할 때 이 네임스페이스 안에 API를 추가한다.

## Internal Admin API v1

- `GET /api/internal/v1/health`: 내부 관리자 API 상태 확인, 최고관리자 권한 필요

배치 서버, 운영자 도구, 내부 시스템 연동은 이 네임스페이스를 사용한다. 운영 배포 시 API Gateway, Private Subnet, IP 제한, MFA, 감사 로그 정책을 함께 적용한다.

## Web Admin API 인증

- `POST /api/auth/login`: 아이디/비밀번호 로그인
- `POST /api/auth/logout`: 로그아웃
- `GET /api/auth/me`: 현재 사용자 조회
- `POST /api/auth/change-password`: 비밀번호 변경

## 사용자 관리

- `GET /api/admin/users`: 사용자 목록
- `POST /api/admin/users`: 사용자 생성 및 역할 부여
- `PUT /api/admin/users/:id`: 사용자 수정 및 역할 변경
- `PATCH /api/admin/users/:id/deactivate`: 비활성화

`ADMIN`, `EXECUTIVE`, `SUPER_ADMIN` 같은 상위 권한 부여와 최고관리자 계정 수정은 `SUPER_ADMIN`만 가능하다.

## 정비 접수/업무

- `GET /api/work-orders`: 정비건 목록
- `POST /api/work-orders`: 정비의뢰 접수
- `GET /api/work-orders/:id`: 상세 조회
- `PUT /api/work-orders/:id`: 접수 내용 수정
- `PATCH /api/work-orders/:id/priority`: Priority 지정/변경
- `PATCH /api/work-orders/:id/assign`: 담당 정비사 배정
- `PATCH /api/work-orders/:id/target`: target 날짜 지정
- `POST /api/work-orders/:id/target-change-requests`: target 변경 요청
- `POST /api/work-orders/:id/start`: 작업 시작
- `POST /api/work-orders/:id/report`: 완료보고 제출
- `POST /api/work-orders/:id/approve`: 관리자 승인
- `POST /api/work-orders/:id/reject`: 관리자 반려
- `POST /api/work-orders/:id/comments`: 댓글/추가 지시
- `POST /api/work-orders/:id/archive`: 보관 처리

## 파일

- `POST /api/uploads/work-order`: 접수/작업 사진 및 동영상 업로드
- `POST /api/uploads/work-report`: 완료보고 사진 및 동영상 업로드
- `GET /api/files/:id`: 업로드 파일 조회

## 계획업무와 일정

- `GET /api/daily-plans`: 계획업무 목록
- `POST /api/daily-plans/request`: 계획업무 요청
- `PUT /api/daily-plans/:id`: 계획업무 수정
- `POST /api/daily-plans/:id/approve`: 승인
- `POST /api/daily-plans/:id/reject`: 반려
- `GET /api/calendar/tasks`: target 일정 조회

## 장비/Master List

- `GET /api/equipment/lookup?keyword=`: 장비번호 정규화 조회
- `POST /api/equipment/import-master-list`: `docs/templates` Master List import
- `GET /api/equipment/:id`: 장비 상세
- `GET /api/equipment/:id/history`: 장비별 정비이력

## KPI

- `GET /api/admin/kpi/summary`: KPI 요약
- `GET /api/admin/kpi/mechanics`: 정비사별 KPI
- `GET /api/admin/kpi/priorities`: Priority별 KPI
- `GET /api/admin/kpi/outsource`: 외주 KPI
- `GET /api/admin/kpi/delays`: 지연건 목록
- `GET /api/admin/kpi/exclusions`: KPI 제외 목록
- `POST /api/admin/kpi/exclusions`: KPI 제외 등록
- `DELETE /api/admin/kpi/exclusions/:id`: KPI 제외 해제
- `GET /api/admin/kpi/export`: KPI 엑셀 다운로드

## 엑셀 다운로드

- `GET /api/exports/daily-status`
- `GET /api/exports/work-diary`
- `GET /api/exports/monthly`
- `GET /api/exports/site`
- `GET /api/exports/mechanic`
- `GET /api/exports/pending`
- `GET /api/exports/completed`
- `GET /api/exports/equipment-history`

## 감사 로그

- `GET /api/admin/audit-logs`
