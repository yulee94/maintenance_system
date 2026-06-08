# API 명세

모든 API는 JSON 응답을 기본으로 하며 성공 시 `{ ok: true, data }`, 실패 시 `{ ok: false, error }` 형식을 사용한다. 엑셀 다운로드 API는 `.xlsx` 바이너리를 반환한다.

## 인증

- `POST /api/auth/login`: 아이디/비밀번호 로그인
- `POST /api/auth/logout`: 로그아웃
- `GET /api/auth/me`: 현재 사용자 조회
- `POST /api/auth/change-password`: 비밀번호 변경

## 사용자 관리

- `GET /api/admin/users`: 사용자 목록
- `POST /api/admin/users`: 사용자 생성
- `PUT /api/admin/users/:id`: 사용자 수정
- `PATCH /api/admin/users/:id/deactivate`: 비활성화

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

- `POST /api/uploads/work-order`: 접수/작업 사진·동영상 업로드
- `POST /api/uploads/work-report`: 완료보고 사진·동영상 업로드
- `GET /api/files/:id`: 업로드 파일 조회

## 계획업무와 달력

- `GET /api/daily-plans`: 계획업무 목록
- `POST /api/daily-plans/request`: 계획업무 요청
- `PUT /api/daily-plans/:id`: 계획업무 수정
- `POST /api/daily-plans/:id/approve`: 승인
- `POST /api/daily-plans/:id/reject`: 반려
- `GET /api/calendar/tasks`: target 달력 조회

## 장비/Master List

- `GET /api/equipment/lookup?keyword=`: 장비번호 정규화 조회
- `POST /api/equipment/import-master-list`: `docs/templates` Master List import
- `GET /api/equipment/:id`: 장비 상세
- `GET /api/equipment/:id/history`: 차량별 정비이력

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

## 감사로그

- `GET /api/admin/audit-logs`
