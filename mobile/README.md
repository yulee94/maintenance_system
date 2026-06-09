# Maintenance Mobile App

정비 렌탈 운영 시스템의 React Native + Expo 모바일 앱입니다. iOS와 Android를 같은 코드베이스로 개발하고, Development App / Staging App / Production App을 분리해서 운영합니다.

## 실행

```powershell
cd mobile
npm install
copy .env.example .env
npm run start
```

실제 휴대폰에서 로컬 PC API에 접속하려면 `.env`의 `DEV_API_URL`을 PC 내부망 IP로 바꿉니다.

```text
DEV_API_URL=http://192.168.0.10:3000
```

## 앱 환경

| 앱 | APP_ENV | API 설정 | 앱 식별자 예시 |
| --- | --- | --- | --- |
| Development App | `dev` | `DEV_API_URL` | `com.bitween.maintenance.dev` |
| Staging App | `staging` | `STAGING_API_URL` | `com.bitween.maintenance.staging` |
| Production App | `prod` | `PROD_API_URL` | `com.bitween.maintenance` |

`app.config.js`가 `APP_ENV`를 기준으로 앱 이름, slug, scheme, iOS bundle id, Android package name, API URL을 자동 선택합니다.

## 모바일 API

모바일 앱은 관리자 웹 API를 직접 호출하지 않고 버전이 있는 Mobile App API만 사용합니다.

- `POST /api/v1/login`
- `POST /api/v1/logout`
- `GET /api/v1/me`
- `POST /api/v1/devices/register`
- `GET /api/v1/branches`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks/:id/start`
- `POST /api/v1/tasks/:id/report`
- `POST /api/v1/sync`
- `POST /api/v1/ai`
- `GET /api/v2/tasks`

공통 헤더:

```text
X-Client-Platform: mobile
X-Device-Id: {device-id}
Authorization: Bearer {session-token}
```

세션 토큰과 기기 식별자는 `expo-secure-store`에 저장합니다. iOS는 Keychain, Android는 Keystore 기반 저장소를 사용하며, 비밀번호 원문과 민감정보 평문은 앱 내부에 저장하지 않습니다.

## 푸시 알림

앱은 로그인 후 OS 푸시 권한을 요청하고 `expo-notifications`로 네이티브 FCM/APNs 토큰을 발급받아 `/api/v1/devices/register`에 등록합니다.

필수 알림 유형:

- 작업 배정 알림
- 승인 요청 알림
- 공지사항
- 장애 알림
- 입고/출고 알림
- 예약 알림
- 결제/정산 알림

## 오프라인 모드

현장 정비사는 네트워크가 끊겨도 작업 시작과 완료 보고를 로컬 SQLite 큐에 저장할 수 있습니다. 인터넷이 복구되면 `/api/v1/sync`로 중앙 서버와 동기화하며, 서버는 `device_id + request_id` 기준으로 중복 요청을 차단합니다.

## 빌드

```powershell
npx eas build --profile development --platform android
npx eas build --profile staging --platform all
npx eas build --profile production --platform all
```

기존 호환을 위해 `preview` profile은 `staging`을 상속합니다.

## 배포 자동화

GitHub Actions의 `.github/workflows/mobile-ci.yml`이 아래 순서를 담당합니다.

```text
Git push
  -> 자동 테스트
  -> iOS/Android EAS 빌드
  -> TestFlight / Play Internal Testing 배포
  -> 검수
  -> 스토어 출시
```

필수 CI 설정:

- GitHub Variables: `DEV_API_URL`, `STAGING_API_URL`, `PROD_API_URL`
- GitHub Secrets: `EXPO_TOKEN`, `SENTRY_DSN`, `AMPLITUDE_API_KEY`
- EAS 또는 Fastlane 자격증명: Apple Developer, App Store Connect, Google Play service account

Fastlane lane은 `mobile/fastlane`에 있으며, EAS 외부에서 빌드 산출물을 TestFlight 또는 Play Console에 직접 업로드해야 할 때 사용합니다.

## 스토어 심사 준비

출시 제출 전에는 [App Store Review Checklist](../docs/APP_STORE_REVIEW_CHECKLIST.md)를 기준으로 심사용 계정, 개인정보 처리방침 URL, 권한 요청 설명, 빈 화면 smoke test, 결제 정책 해당 여부를 확인합니다.

심사 메모 초안은 [mobile/release/APP_REVIEW_NOTES.md](./release/APP_REVIEW_NOTES.md)에 있습니다.

스토어 메타데이터와 테스트 사업장 자료는 [mobile/release/store-metadata/ko-KR](./release/store-metadata/ko-KR)에 있습니다. 앱 아이콘과 스크린샷 초안은 아래 명령으로 재생성할 수 있습니다.

```powershell
node scripts/generate-mobile-review-assets.mjs
```
