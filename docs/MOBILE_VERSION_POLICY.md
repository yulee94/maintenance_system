# Mobile Version Policy

모바일 앱은 실행 시 서버의 버전 정책을 먼저 확인합니다. 서버 정책은 앱 재배포 없이 환경변수만으로 조정할 수 있습니다.

## API

```text
GET /api/v1/mobile-config?app_version=1.0.0&platform=ios&app_env=prod
```

응답 핵심 필드:

```json
{
  "minimum_supported_version": "1.1.0",
  "latest_version": "1.2.0",
  "current_version": "1.0.0",
  "force_update_required": true,
  "maintenance_mode": false,
  "notice_message": "현재 앱 버전 1.0.0은 더 이상 지원되지 않습니다. 1.1.0 이상으로 업데이트해 주세요.",
  "update_available": true
}
```

예시:

```text
현재 앱 버전: 1.0.0
서버 최소 지원 버전: 1.1.0
결과: force_update_required=true
앱 동작: 업데이트 안내 화면을 표시하고 업무 화면 진입 차단
```

## 서버 환경변수

| 변수 | 설명 | 예시 |
| --- | --- | --- |
| `MOBILE_MINIMUM_SUPPORTED_VERSION` | 접속을 허용할 최소 앱 버전 | `1.1.0` |
| `MOBILE_LATEST_VERSION` | 스토어에 올라간 최신 버전 | `1.2.0` |
| `MOBILE_FORCE_UPDATE_REQUIRED` | 모든 버전에 강제 업데이트 적용 | `false` |
| `MOBILE_MAINTENANCE_MODE` | 서버 점검 모드 | `false` |
| `MOBILE_NOTICE_MESSAGE` | 앱에 표시할 공지/업데이트 안내 문구 | `긴급 점검 중입니다.` |
| `MOBILE_IOS_STORE_URL` | iOS 업데이트 이동 URL | App Store URL |
| `MOBILE_ANDROID_STORE_URL` | Android 업데이트 이동 URL | Play Store URL |

## 앱 동작

- `maintenance_mode=true`: 점검 안내 화면을 표시하고 로그인/업무 화면 진입을 차단합니다.
- `current_version < minimum_supported_version`: 강제 업데이트 화면을 표시합니다.
- `current_version < latest_version`: 닫을 수 있는 업데이트 안내 배너를 표시합니다.
- 정책 API 호출 실패: 빈 화면을 만들지 않고 앱 사용을 허용하되 경고 배너를 표시합니다.

## 운영 순서

1. Staging 앱으로 새 버전을 배포합니다.
2. 파일럿 검수 후 `MOBILE_LATEST_VERSION`을 새 버전으로 올립니다.
3. 구버전 차단이 필요하면 `MOBILE_MINIMUM_SUPPORTED_VERSION`을 올립니다.
4. 치명적 장애가 있으면 `MOBILE_MAINTENANCE_MODE=true` 또는 `MOBILE_FORCE_UPDATE_REQUIRED=true`를 적용합니다.
5. 조치 후 환경변수를 되돌리고 `/api/v1/mobile-config` 응답을 확인합니다.
