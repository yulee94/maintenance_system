# Maintenance Mobile App

React Native + Expo 기반 정비 렌탈 운영 모바일 앱입니다. iOS와 Android를 같은 코드베이스에서 빠르게 출시하기 위해 Expo Router와 EAS Build 기준으로 구성했습니다.

## 화면 구성

- 오늘: 미결/완료/내 작업/긴급 요약, 오늘 진행 작업, AI 장비 경고
- 정비건: 미결 정비건 priority 필터
- 완료건: 완료/보관/취소 정비 이력
- AI: 정비 문의, 유사 고장 이력, 보고서 초안 작성

## 실행

```powershell
cd mobile
npm install
copy .env.example .env
npm run start
```

실제 휴대폰에서 로컬 PC의 API에 접속하려면 `.env`의 `EXPO_PUBLIC_API_BASE_URL`을 PC의 내부망 IP로 바꿉니다.

예시:

```text
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:3000
```

## 환경 분리

모바일 앱은 서버 환경과 동일하게 분리합니다.

| 앱 | API |
| --- | --- |
| 개발 앱 | dev API |
| 테스트 앱 | staging API |
| 출시 앱 | prod API |

`eas.json`의 `development`, `preview`, `production` profile에 각 환경의 API URL을 넣습니다.

## 인증

모바일 앱은 다음 헤더를 사용합니다.

```text
X-Client-Platform: mobile
X-Device-Id: {device-id}
Authorization: Bearer {session-token}
```

웹 쿠키 세션은 유지하고, 모바일 클라이언트는 로그인 응답의 `sessionToken`을 `expo-secure-store`에 저장합니다.

## 빌드

EAS CLI 설정 후 아래 방식으로 빌드합니다.

```powershell
npx eas build --profile preview --platform android
npx eas build --profile preview --platform ios
npx eas build --profile production --platform all
```

## 현재 범위

현재 앱은 iOS/Android 공통 MVP입니다. 로그인, 정비건 조회, 작업 시작, 완료보고 제출, AI 질의가 연결되어 있습니다. 카메라/앨범 사진 첨부, push notification, 생체인증, 기기 폐기 관리는 다음 모바일 릴리스에서 추가합니다.
