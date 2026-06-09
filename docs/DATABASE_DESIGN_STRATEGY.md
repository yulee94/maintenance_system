# Database Design Strategy

이 문서는 정비 렌탈 운영 시스템의 DB 설계 기준입니다. 현재 프로젝트의 Prisma datasource는 PostgreSQL로 설정되어 있으므로 실제 구현은 PostgreSQL을 우선 기준으로 합니다. 다만 장기적으로 MySQL을 선택할 가능성도 열어두고, 테이블/권한/인덱스 설계는 특정 DB에 과도하게 종속되지 않게 유지합니다.

## DB 선택 기준

| 항목 | 기준 |
| --- | --- |
| 우선 DB | PostgreSQL |
| 대체 가능 DB | MySQL |
| ORM | Prisma |
| 운영 방식 | Managed DB 우선 |
| 리전 | 한국 리전 중앙 클라우드 |

PostgreSQL을 우선하는 이유:

- 현재 코드가 `provider = "postgresql"`로 설정되어 있습니다.
- JSON, 인덱스, 트랜잭션, 리포팅 쿼리, 감사 로그 확장성이 좋습니다.
- 정비 이력, KPI, 장비별 누적 데이터, AI 검색 보조 데이터에 적합합니다.

MySQL을 선택할 경우 별도 검토가 필요한 항목:

- Prisma schema provider 변경과 마이그레이션 재작성
- JSON 컬럼, 날짜/시간, full text search, case sensitivity 차이
- 기존 PostgreSQL migration과 seed 데이터 호환성

## 운영 DB 요구사항

운영 DB는 아래 기준을 충족해야 합니다.

| 요구사항 | 기준 |
| --- | --- |
| Multi-AZ | 장애 시 자동 failover가 가능한 managed DB 구성을 사용 |
| 자동 백업 | 매일 자동 백업과 point-in-time recovery를 활성화 |
| 읽기 복제본 | KPI, 보고서, 대량 조회, export 부하 분산용 read replica 검토 |
| 암호화 | 저장 데이터 암호화와 전송 구간 TLS 적용 |
| 접속 제한 | API 서버, batch 서버, 승인된 관리자 네트워크만 DB 접속 허용 |
| 감사 추적 | 권한 변경, 승인/반려, 파일 다운로드, 민감 조회 로그 보관 |

`prod` DB는 외부 인터넷에서 직접 접속하지 않도록 합니다. 운영 접근은 VPN, Zero Trust, bastion, private network 중 하나 이상의 통제 경로를 사용합니다.

## 환경별 DB 분리

`dev`, `staging`, `prod`는 DB를 반드시 분리합니다.

| 환경 | DB 기준 |
| --- | --- |
| `dev` | 개발용 DB. 초기화 가능하며 더미/샘플 데이터만 사용 |
| `staging` | 검수용 DB. 운영 유사 데이터는 익명화 후 사용 |
| `prod` | 실제 운영 DB. 실제 고객, 직원, 장비, 정비, 승인, 파일 메타데이터 보관 |

`prod` 데이터를 원본 그대로 `dev`로 복사하지 않습니다. 운영 데이터가 필요하면 익명화 후 `staging`에만 제한적으로 반영합니다.

## Branch 기준 데이터 분리

모든 주요 운영 테이블에는 `branch_id`를 포함합니다.

| 논리 테이블 | 필수 컬럼 | 설명 |
| --- | --- | --- |
| `orders` | `branch_id` | 주문, 렌탈 요청, 접수 데이터의 사업장 기준 |
| `inventory` | `branch_id` | 부품, 재고, 소모품의 사업장 기준 |
| `employees` | `branch_id` | 직원, 정비사, 관리자 기본 소속 사업장 |
| `work_orders` | `branch_id` | 정비 접수, 배정, 진행, 완료, 승인 데이터 |
| `devices` | `branch_id` | 장비, 지게차, 모바일 단말, 현장 자산 데이터 |

현재 Prisma 모델에 적용할 때는 TypeScript 필드명을 `branchId`로 두고 DB 컬럼명은 `@map("branch_id")`로 고정합니다.

```prisma
branchId String? @map("branch_id")
```

초기 마이그레이션은 nullable로 시작하고, 기존 데이터 backfill과 검증이 끝난 뒤 필수값으로 전환합니다.

## 권한 모델

권한은 역할(role)과 접근 가능한 사업장(branch)을 함께 판단합니다.

| 사용자 구분 | 접근 범위 |
| --- | --- |
| 본사 | 전체 `branch_id` 조회 가능 |
| 최고 관리자 | 전체 또는 지정된 전체 사업장 관리 가능 |
| 관리자 | 여러 `branch_id` 접근 가능 |
| 일반 직원 | 자기 `branch_id`만 접근 가능 |
| 정비사 | 자기 `branch_id` 및 본인 배정 정비건만 접근 가능 |

권장 모델:

```prisma
model Branch {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model UserBranch {
  id        String   @id @default(cuid())
  userId    String
  branchId  String
  isPrimary Boolean  @default(false)
  createdAt DateTime @default(now())

  @@unique([userId, branchId])
  @@index([branchId])
}
```

서버 측 조회 규칙:

```ts
const branchScope = await resolveBranchScope(session.userId);

const where = branchScope.allBranches
  ? { deletedAt: null }
  : { branchId: { in: branchScope.branchIds }, deletedAt: null };
```

프론트엔드에서 전달된 `branchId`는 검색 조건으로만 사용하고, 최종 접근 가능 여부는 서버에서 `UserBranch` 또는 본사 권한을 기준으로 다시 판단합니다.

## 주요 테이블 확장 순서

1. `Branch` 사업장 원장 추가
2. `UserBranch` 사용자-사업장 권한 테이블 추가
3. `employees.branch_id` 또는 사용자/직원 매핑에 branch 연결 추가
4. `work_orders.branch_id` 추가
5. `devices.branch_id` 추가
6. `orders.branch_id`, `inventory.branch_id`는 주문/재고 모듈 연결 시 추가
7. API, KPI, 보고서, AI, export에 branch 권한 필터 적용
8. backfill 검증 후 필수값과 인덱스 강화

## 인덱스 기준

대부분의 운영 조회는 `branch_id`를 첫 번째 조건으로 사용합니다.

| 테이블 | 추천 인덱스 |
| --- | --- |
| `work_orders` | `(branch_id, status)`, `(branch_id, request_date)`, `(branch_id, assigned_mechanic_id)`, `(branch_id, priority_level)` |
| `devices` | `(branch_id, normalized_no)`, `(branch_id, status)`, `(branch_id, location)` |
| `employees` | `(branch_id, is_active)`, `(branch_id, employee_id)` |
| `inventory` | `(branch_id, item_code)`, `(branch_id, location_code)` |
| `orders` | `(branch_id, order_date)`, `(branch_id, order_status)` |

보고서와 KPI는 운영 트랜잭션 DB에 직접 큰 부하를 주지 않도록 read replica, materialized view, batch summary table 중 하나를 검토합니다.

## 접속 제한과 시크릿

- `DATABASE_URL`은 환경별로 별도 발급합니다.
- DB 계정은 `dev`, `staging`, `prod`를 분리합니다.
- API 서버용 계정과 배치 서버용 계정은 권한을 분리합니다.
- 마이그레이션 계정은 일반 API 런타임 계정보다 강한 권한을 가지므로 별도 보관합니다.
- DB 직접 접속 권한은 최소 인원으로 제한하고, 접속 로그를 남깁니다.
- 운영 DB 비밀번호, 인증서, 백업 파일은 GitHub에 커밋하지 않습니다.

## 현재 적용 범위

이번 문서는 DB 설계 기준을 고정하기 위한 문서입니다. 현재 변경에서는 실제 Prisma schema, migration, API 로직은 수정하지 않습니다. 다음 구현 단계에서 `Branch`, `UserBranch`, `branchId`, 서버 측 권한 필터, branch별 테스트를 별도 작업으로 추가합니다.
