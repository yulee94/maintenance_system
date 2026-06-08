# maintenance_system

정비/렌탈 업무 접수, 배정, 정비사 작업보고, 관리자 승인, 임원 KPI 보고, 엑셀 다운로드를 통합하는 Next.js 기반 업무 시스템입니다.

## 주요 기능

- 아이디/비밀번호 로그인, JWT 쿠키 세션
- 최고 관리자, 관리자, 임원, 정비사, 접수자 권한 분리
- 고민서 책임 최고 관리자 계정으로 하부 사용자 생성 및 권한 부여
- 정비 접수번호 자동 생성과 장비 번호 조회
- Priority, 담당자 배정, target 일정, target 변경 요청
- 정비사 작업 시작 및 완료보고
- 관리자 승인/반려, KPI 집계, 감사로그
- 임원 보고용 전체 현황, 지연 리스크, 정비사별 KPI, Priority별 KPI
- 기존 Excel 양식 보관 및 다운로드 엔드포인트
- PostgreSQL 운영 모드와 DB 없이 보는 데모 모드 지원

## 템플릿 파일

기존 업무 양식은 아래 경로에 보관합니다.

```text
docs/templates/
  Master list_251120 현재.xlsx
  6월5일 일일업무진행현황.xlsx
  26.05.27업무일지.xlsx
```

## 빠른 실행

서브 담당자가 DB 없이 화면만 프리뷰할 때는 아래 명령을 사용합니다. `.env`나 PostgreSQL이 없어도 데모 데이터로 제품 서버 모드가 실행됩니다.

```powershell
npm.cmd install
npm.cmd run preview
```

이미 빌드가 되어 있고 서버만 다시 켜려면 아래 명령을 사용할 수 있습니다.

```powershell
npm.cmd run preview:quick
```

프리뷰 서버는 기본적으로 `0.0.0.0:3000`으로 열리므로 같은 사무실/내부망에서는 스크립트가 출력하는 Network URL로도 접속할 수 있습니다. 외부 인터넷에서 접속하려면 별도 배포 서버, 터널, 방화벽/공유기 설정이 필요합니다.

현재 PC처럼 PostgreSQL이나 Docker가 준비되지 않은 환경에서 수동으로 실행하려면 `.env`에 데모 모드를 켜고 제품 서버 모드로 실행할 수 있습니다.

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run build
npm.cmd run start
```

`.env`의 주요 값:

```text
DEMO_MODE="true"
APP_BASE_URL="http://localhost:3000"
```

접속 URL:

```text
http://localhost:3000
```

## 데모 계정

로그인 화면에서 아래 계정을 버튼으로 바로 선택할 수 있습니다.

```text
최고관리자: ko.ms / Admin!2026Test      고민서 책임
임원:       kim.ms / Exec!2026Test       김민식 전무
관리자:     son.hn / Admin2!2026Test     손화나 선임
정비사:     jegal.ts / Mech!2026Test     제갈태수 책임
접수자:     park.jw / Reception!2026     박지우 매니저
```

## 역할별 시연 포인트

- 임원: 현황, 정비건 조회, 일정, 보고/KPI, 엑셀 메뉴가 보입니다. 처리 버튼 없이 전체 완료율, 긴급/지연, 정비사별 KPI를 확인합니다.
- 관리자: 접수, 정비건 배정, target 지정, 보고 승인/반려, 사용자 생성, 권한 부여, 감사로그를 확인합니다.
- 정비사: 내 작업 탭에서 본인에게 배정된 업무만 보고 작업 시작, 완료보고, target 변경 요청을 처리합니다.
- 접수자: 신규 정비 접수와 장비 중복 조회 흐름을 확인합니다.
- 최고관리자: 관리자 기능에 더해 상위 권한과 최고 관리자 권한까지 부여할 수 있습니다.

## PostgreSQL 운영 모드

PostgreSQL을 사용할 때는 `.env`에서 `DEMO_MODE="false"`로 두고 `DATABASE_URL`을 실제 DB에 맞춥니다.

Docker가 설치된 환경:

```powershell
docker compose up -d postgres
npm.cmd run prisma:migrate -- --name init
npm.cmd run db:seed
npm.cmd run build
npm.cmd run start
```

## 검증

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## 데이터 안전

- `.env`, 업로드 파일, 백업 파일, 로컬 세션 파일은 Git에 올리지 않습니다.
- 운영 배포 전 `JWT_SECRET`은 길고 예측 불가능한 값으로 변경합니다.
- 실제 직원 명부, 고객 민감 정보, API 키, 쿠키, 비밀번호는 커밋하지 않습니다.
