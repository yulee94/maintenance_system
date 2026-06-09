# Branch Data Partitioning Strategy

이 문서는 정비 렌탈 운영 시스템과 향후 Bitween/payroll, 근태, 재고, 주문 모듈을 연결할 때 사용할 사업장 단위 데이터 관리 기준입니다.

현재 코드의 `tenantId`/`tenant_id`는 회사 또는 테넌트 경계를 나타내고, 아래 `branch_id`는 전국 사업장, 지점, 센터 단위의 운영 데이터 경계를 나타냅니다. 두 값은 서로 대체하지 않습니다.

## 기준 컬럼

운영 데이터는 다음 컬럼을 기준으로 사업장별 분리와 권한 필터링을 적용합니다.

| 논리 테이블 | 기준 컬럼 | 용도 |
| --- | --- | --- |
| `orders` | `orders.branch_id` | 주문, 접수, 외부 ERP 주문 데이터의 사업장 구분 |
| `inventory` | `inventory.branch_id` | 부품, 재고, 소모품 위치와 수량의 사업장 구분 |
| `employees` | `employees.branch_id` | 직원 기본 소속 사업장 또는 주 근무지 구분 |
| `work_orders` | `work_orders.branch_id` | 정비 접수, 배정, 완료, 승인 데이터의 사업장 구분 |
| `devices` | `devices.branch_id` | 장비, 지게차, 모바일 단말, 현장 자산의 사업장 구분 |

## 현재 모델 매핑

현재 Prisma 모델은 아직 위 논리 테이블명과 완전히 1:1로 맞추지 않았습니다. 다음 매핑을 기준으로 충돌 없이 확장합니다.

| 현재 모델 | 향후 논리 테이블 | 비고 |
| --- | --- | --- |
| `WorkOrder` | `work_orders` | 정비 접수와 처리 이력. 향후 `branchId String? @map("branch_id")` 추가 대상 |
| `Equipment` | `devices` | 전체 장비/지게차 자산. 향후 `branchId String? @map("branch_id")` 추가 대상 |
| `User` 또는 Bitween 직원 원장 | `employees` | 직원/정비사 소속 사업장. 급여 개인정보는 maintenance_system에 복제하지 않음 |
| 외부 주문 모듈 | `orders` | ERP 또는 렌탈 주문 시스템 연동 시 별도 계약으로 추가 |
| 외부 재고 모듈 | `inventory` | 부품 재고 시스템 연동 시 별도 계약으로 추가 |

## 충돌 방지 원칙

1. 기존 `tenantId`/`tenant_id` 필드는 이름을 바꾸지 않습니다.
2. `branch_id`는 `tenant_id`를 대체하지 않고, 같은 테넌트 내부의 사업장 범위를 좁히는 필터로 사용합니다.
3. 기존 기능 변경 PR에서 임의로 `branch_id` 스키마를 섞어 넣지 않습니다. 사업장 분리 작업은 별도 마이그레이션과 테스트로 진행합니다.
4. Prisma 모델에는 TypeScript 관례를 따라 `branchId`로 선언하고, DB 컬럼은 `@map("branch_id")`로 고정합니다.
5. API는 프론트엔드에서 넘어온 `branchId`만 믿지 않고, 서버 세션의 허용 사업장 목록으로 반드시 다시 필터링합니다.
6. 엑셀 import/export, 보고서, KPI, AI 조회는 모두 사용자의 허용 사업장 범위 안에서만 데이터를 반환합니다.
7. 파일 업로드를 Object Storage로 옮길 때는 경로에 테넌트와 사업장 키를 포함합니다.

예시:

```text
{tenant_id}/{branch_id}/work-orders/{work_order_id}/{file_name}
```

## Prisma 적용 예시

실제 적용은 별도 마이그레이션에서 진행합니다. 기존 데이터 backfill 전까지는 nullable로 시작합니다.

```prisma
model WorkOrder {
  id       String  @id @default(cuid())
  branchId String? @map("branch_id")

  @@index([branchId, status])
  @@index([branchId, requestDate])
}

model Equipment {
  id       String  @id @default(cuid())
  branchId String? @map("branch_id")

  @@index([branchId, normalizedNo])
}
```

## 권장 마이그레이션 순서

1. `Branch` 또는 사업장 원장 모델을 먼저 만든다.
2. 사용자와 사업장 권한을 연결하는 `UserBranch` 또는 동등한 멤버십 모델을 만든다.
3. `WorkOrder`, `Equipment`부터 nullable `branchId`를 추가한다.
4. 기존 `Site`, 고객사, 장비 위치, 직원 소속 정보를 기준으로 `branchId`를 backfill한다.
5. 목록, 상세, KPI, 보고서, AI, export API에 서버 측 사업장 필터를 적용한다.
6. 운영 데이터 검증 후 필요한 테이블의 `branchId`를 필수값으로 전환한다.
7. `orders`, `inventory`, `employees`, `work_orders`, `devices` 통합 계약 테스트를 추가한다.

## API 필터 규칙

목록 API는 다음 규칙을 따릅니다.

- `SUPER_ADMIN`: 전체 테넌트 또는 지정 사업장 조회 가능
- `ADMIN`: 본인이 관리하는 사업장만 조회 및 승인 가능
- `EXECUTIVE`: 허용된 사업장의 KPI, 보고서, 자산 리스크 조회 가능
- `MECHANIC`: 본인에게 배정되었거나 본인 사업장에 공개된 작업만 조회 가능
- `RECEPTIONIST`: 접수 권한이 있는 사업장만 접수 및 조회 가능

서버 구현에서는 다음 형태를 권장합니다.

```ts
const allowedBranchIds = await getAllowedBranchIds(session.userId);

const where = {
  branchId: { in: allowedBranchIds },
  deletedAt: null
};
```

## 인덱스 우선순위

대량 데이터 전환 전에 아래 인덱스를 우선 검토합니다.

| 테이블 | 추천 인덱스 |
| --- | --- |
| `work_orders` | `(branch_id, status)`, `(branch_id, request_date)`, `(branch_id, assigned_mechanic_id)` |
| `devices` | `(branch_id, normalized_no)`, `(branch_id, status)` |
| `employees` | `(branch_id, is_active)`, `(branch_id, employee_id)` |
| `inventory` | `(branch_id, item_code)`, `(branch_id, location_code)` |
| `orders` | `(branch_id, order_date)`, `(branch_id, order_status)` |

## 현재 결정

이번 변경에서는 실제 DB 스키마와 기존 파일은 수정하지 않습니다. `branch_id` 기준을 문서로 먼저 고정하여, 다음 개발자가 동일 기준으로 마이그레이션, API 필터, 테스트를 안전하게 추가할 수 있게 합니다.
