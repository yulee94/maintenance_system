# maintenance_system

정비/렌탈 업무 접수, 배정, 작업보고, KPI, 엑셀 다운로드를 통합하는 Next.js 기반 업무 시스템입니다.

## 포함 기능

- 아이디/비밀번호 로그인, bcrypt 비밀번호 해시, JWT 쿠키 세션
- 관리자/정비사/접수자/임원 role 기반 권한
- 최고 관리자 계정의 하부 사용자 생성 및 권한 부여
- 정비의뢰 접수번호 자동 생성
- 장비번호 정규화 조회
- `docs/templates/Master list_251120 현재.xlsx` 기반 장비 import
- Priority, 담당자 배정, target 일정, target 변경 요청
- 정비사 작업 시작, 완료보고, 사진/동영상 업로드
- 관리자 승인/반려, KPI 제외, 감사로그
- 일일업무진행현황, 업무일지, 미결/완료/KPI 엑셀 다운로드
- Docker Compose 기반 PostgreSQL 실행 구조
- 백업 스크립트

## 주요 문서

- [설계 문서](docs/DESIGN.md)
- [API 명세](docs/API.md)
- [권한 매트릭스](docs/PERMISSIONS.md)
- [화면 목록](docs/SCREENS.md)

## 템플릿 파일

기존 엑셀 양식은 아래 경로에 보관합니다.

```text
docs/templates/
  Master list_251120 현재.xlsx
  6월5일 일일업무진행현황.xlsx
  26.05.27업무일지.xlsx
```

## 로컬 실행

1. 환경 변수를 준비합니다.

```powershell
Copy-Item .env.example .env
```

PostgreSQL 없이 화면과 계정 생성 흐름만 먼저 테스트하려면 `.env`에서 다음 값을 켭니다.

```text
DEMO_MODE="true"
```

데모 모드에서는 고민서 책임 테스트 계정과 샘플 정비건이 메모리 데이터로 동작합니다. 서버를 재시작하면 데모 생성 데이터는 초기화됩니다.

2. PostgreSQL을 준비합니다.

Docker가 설치된 환경:

```powershell
docker compose up -d postgres
```

Docker가 없는 환경에서는 PostgreSQL을 직접 설치하고 `.env`의 `DATABASE_URL`을 맞춥니다.

3. 의존성을 설치합니다.

```powershell
npm.cmd install
```

4. DB schema와 seed 데이터를 적용합니다.

```powershell
npm.cmd run prisma:migrate -- --name init
npm.cmd run db:seed
```

5. 개발 서버를 실행합니다.

```powershell
npm.cmd run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 초기 계정

최고 관리자 테스트 계정은 고민서 책임으로 seed됩니다.

```text
ko.ms / Admin!2026Test
```

고민서 책임 계정은 관리자 화면에서 하부 사용자 계정을 생성하고 정비사, 접수자, 관리자, 임원/대표, 최고 관리자 권한을 부여할 수 있습니다. 일반 관리자 계정은 상위 권한을 새로 부여할 수 없도록 서버에서 제한합니다.

그 외 seed 사용자의 임시 비밀번호는 다음과 같습니다.

```text
ChangeMe!2026
```

예시 로그인:

```text
ko.ms / Admin!2026Test
son.hn / ChangeMe!2026
kim.ms / ChangeMe!2026
jegal.ts / ChangeMe!2026
```

최초 로그인 후 비밀번호 변경 흐름을 사용하도록 설계되어 있습니다.

## 검증

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## 백업

PostgreSQL client tool인 `pg_dump`가 설치된 환경에서 실행합니다.

```powershell
npm.cmd run backup
```

백업 결과는 `storage/backups/` 아래에 생성됩니다.

## 운영 주의

- `.env`, 업로드 파일, 백업 파일은 Git에 커밋하지 않습니다.
- `JWT_SECRET`은 운영 배포 전에 긴 랜덤 문자열로 변경합니다.
- 로컬 파일 저장소는 추후 Object Storage로 교체할 수 있도록 `src/lib/storage.ts`에 격리되어 있습니다.
- Excel 양식 정밀 복제는 `src/lib/exports.ts`에서 템플릿 기반 출력으로 계속 보강합니다.
