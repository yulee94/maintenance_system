# Maintenance Mobile App

React Native + Expo 기반 정비 렌탈 운영 모바일 앱이다. iOS와 Android를 같은 코드베이스에서 빠르게 출시하기 위해 Expo Router와 EAS Build 기준으로 구성한다.

## 화면 구성

- 오늘: 미결/완료/내 작업/긴급 요약, 오늘 진행 업무, AI 장비 경고
- 정비건: 미결 정비건과 Priority 필터
- 완료건: 완료/보관/취소 정비 이력
- AI: 정비 문의, 유사 고장 이력, 보고서 초안 작성

## 실행

```powershell
cd mobile
npm install
copy .env.example .env
npm run start
```

실제 휴대폰에서 로컬 PC API에 접속하려면 `.env`의 `EXPO_PUBLIC_API_BASE_URL`을 PC 내부망 IP로 바꾼다.

```text
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:3000
```

## 환경 분리

| 앱 | API |
| --- | --- |
| 개발 앱 | dev API |
| 테스트 앱 | staging API |
| 출시 앱 | prod API |

`eas.json`의 `development`, `preview`, `production` profile에 각 환경별 API URL을 넣는다.

## API

모바일 앱은 웹 관리자 API를 직접 호출하지 않고 버전이 있는 Mobile App API만 사용한다.

- `POST /api/v1/login`
- `POST /api/v1/logout`
- `GET /api/v1/me`
- `GET /api/v1/branches`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks/:id/start`
- `POST /api/v1/tasks/:id/report`
- `POST /api/v1/ai`
- `GET /api/v2/tasks`

모바일 앱 공통 헤더:

```text
X-Client-Platform: mobile
X-Device-Id: {device-id}
Authorization: Bearer {session-token}
```

웹 쿠키 세션은 유지하되, 모바일 클라이언트는 로그인 응답의 `sessionToken`을 `expo-secure-store`에 저장하고 Bearer 토큰으로 인증한다.

## 빌드

EAS CLI 설정 후 아래 방식으로 빌드한다.

```powershell
npx eas build --profile preview --platform android
npx eas build --profile preview --platform ios
npx eas build --profile production --platform all
```

## 현재 범위

현재 앱은 iOS/Android 공통 MVP다. 로그인, 정비건 조회, 작업 시작, 완료보고 제출, AI 질의가 연결되어 있다. 카메라 앨범 사진 첨부, push notification, 생체인증, 기기 등록 관리는 다음 모바일 릴리스에서 확장한다.
