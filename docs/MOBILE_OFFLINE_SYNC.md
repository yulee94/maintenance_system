# 모바일 오프라인 동기화

## 목표 구조

```text
앱 로컬 DB
        ↓
오프라인 중 작업 저장
        ↓
인터넷 복구
        ↓
중앙 서버와 동기화
```

## 앱 로컬 DB

React Native 앱은 `expo-sqlite` 기반 `maintenance_offline.db`를 사용한다.

로컬 큐 테이블: `offline_requests`

필수 저장 필드:

- `request_id`
- `sync_id`
- `created_at`
- `device_id`
- `branch_id`
- `operation_type`
- `payload`
- `status`
- `attempts`
- `last_error`

현재 오프라인 저장 대상:

- 작업 시작: `WORK_ORDER_START`
- 완료보고 제출: `WORK_ORDER_REPORT`

## 서버 중복 방지

서버는 `offline_sync_requests` 테이블을 사용한다.

필수 저장 필드:

- `request_id`
- `sync_id`
- `created_at`
- `device_id`

중복 방지 기준:

```text
UNIQUE(device_id, request_id)
```

같은 `device_id + request_id`가 다시 들어오면 서버는 실제 업무 처리를 다시 하지 않고 기존 결과를 반환한다. 따라서 인터넷 복구 시 앱이 같은 요청을 여러 번 재시도해도 중앙 서버에는 한 번만 반영된다.

## API

`POST /api/v1/sync`

요청 예시:

```json
{
  "syncId": "sync_abc",
  "operations": [
    {
      "requestId": "req_001",
      "syncId": "sync_abc",
      "createdAt": "2026-06-09T10:00:00.000Z",
      "branchId": "branch-001",
      "type": "WORK_ORDER_START",
      "payload": {
        "workOrderId": "work-order-id"
      }
    }
  ]
}
```

서버는 `X-Device-Id` 헤더를 해시하여 `device_id`로 저장한다. 원문 기기 ID는 DB에 저장하지 않는다.
