# 모바일 푸시 알림 전략

## 필수 알림 유형

- 작업 배정 알림
- 승인 요청 알림
- 공지사항
- 장애 알림
- 입고/출고 알림
- 예약 알림
- 결제/정산 알림

## 등록 흐름

```text
앱 설치
        ↓
FCM/APNs 토큰 발급
        ↓
서버에 device_token 저장
        ↓
이벤트 발생
        ↓
푸시 발송
```

## DB 저장 기준

`mobile_devices` 테이블에 다음 값을 저장한다.

| DB 컬럼 | 설명 |
| --- | --- |
| `user_id` | 사용자 ID |
| `branch_id` | 사업장 ID, 현재는 문자열로 저장하고 추후 Branch 테이블과 FK 연결 |
| `device_id` | 앱에서 생성한 기기 식별자의 해시 |
| `push_token` | FCM/APNs 네이티브 푸시 토큰 |
| `platform` | `ios` 또는 `android` |
| `app_version` | 앱 버전 |
| `last_active_at` | 마지막 활성 시각 |

## 현재 구현

- React Native 앱은 `expo-notifications`로 네이티브 FCM/APNs 토큰을 발급받는다.
- `/api/v1/devices/register`가 토큰을 서버에 등록한다.
- 서버는 `user_id + device_id` 기준으로 upsert하여 최신 토큰을 유지한다.
- `/api/internal/v1/push/send`는 내부 이벤트 발생 시 대상 사용자/사업장 기기로 발송한다.
- FCM/APNs 자격증명이 없으면 발송 결과를 `not_configured`로 반환한다.

## 운영 환경 변수

```text
FCM_SERVER_KEY
APNS_KEY_ID
APNS_TEAM_ID
APNS_BUNDLE_ID
APNS_PRIVATE_KEY
APNS_USE_SANDBOX
```

정식 출시 전에는 Firebase 프로젝트, Apple Developer APNs 키, 앱 bundle/package ID를 운영 환경과 연결해야 한다.
