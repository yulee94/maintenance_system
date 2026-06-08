# 정비/렌탈 업무 시스템 설계

## 목표

카카오톡으로 흩어져 있던 정비의뢰 접수, 업무 배정, 사진 공유, 완료보고, 미결 관리, KPI 보고를 웹/PWA 기반 업무 시스템으로 전환한다. 초기 버전은 로컬 PC와 사내 서버에서 실행 가능해야 하며, 이후 OCI 같은 클라우드와 Object Storage로 확장할 수 있게 저장소와 배포 경계를 분리한다.

## 기술 구조

- Frontend: Next.js App Router, React, TypeScript
- Backend: Next.js API Routes
- Database: PostgreSQL
- ORM: Prisma
- Auth: 아이디/비밀번호, bcrypt 해시, JWT 쿠키 세션
- File Storage: `storage/uploads` 로컬 저장소
- Excel: `docs/templates` 기존 양식 참조, ExcelJS 기반 다운로드
- Deployment: Docker Compose 또는 로컬 Node.js 실행

## 폴더 구조

```text
docs/
  templates/                 기존 엑셀 템플릿
prisma/
  schema.prisma              전체 DB 모델
  seed.ts                    초기 역할/사용자/기준 데이터
src/
  app/                       화면과 API routes
  components/                React UI
  lib/                       DB, 인증, KPI, Excel, storage 유틸
storage/
  uploads/                   업로드 파일
  backups/                   백업 결과
scripts/
  backup.mjs                 DB/업로드 백업 스크립트
```

## 핵심 업무 흐름

1. 접수자가 정비의뢰를 등록한다.
2. 장비번호는 정규화되어 Master List 장비 정보와 매칭된다.
3. 같은 장비의 미완료 유사 접수건이 있으면 중복 의심 후보를 반환한다.
4. 관리자가 Priority, 담당 정비사, target 날짜를 확정한다.
5. 정비사는 전체 업무를 조회하고 작업 시작, 사진/동영상 업로드, 완료보고를 등록한다.
6. 관리자가 완료보고를 승인 또는 반려한다.
7. 관리자 승인 시점이 KPI 완료 기준이 된다.
8. 지연, 임시조치, 외주, KPI 제외는 별도 상태와 감사로그로 남긴다.
9. 일일현황, 업무일지, 미결/완료/KPI 보고서를 엑셀로 다운로드한다.

## 주요 DB 모델

- User, Role, UserRole, Session
- Customer, Site, Equipment, EquipmentImportLog
- WorkOrder, WorkOrderStatusHistory, WorkOrderAssignmentHistory
- WorkReport, WorkOrderAttachment, WorkReportAttachment
- Comment, TargetChangeRequest, TargetHistory
- DailyWorkPlan, DailyWorkPlanItem
- PriorityConfig, FaultCategory
- OutsourceVendor, OutsourceWork
- KpiExclusion, AuditLog, Notification, ExcelExportLog
- WorkDiary, RegularInspectionSchedule

## 확장 포인트

- `src/lib/storage.ts`: 로컬 저장소를 S3/OCI Object Storage로 교체
- `src/lib/exports.ts`: 기존 엑셀 양식을 더 정밀하게 복제
- `src/lib/kpi.ts`: 월별/분기별/사용자 지정 기간 KPI 확장
- `Notification` 모델: 카카오톡, 문자, 메일 발송 큐로 확장
- Docker Compose: 사내 서버 또는 OCI VM 배포로 확장
