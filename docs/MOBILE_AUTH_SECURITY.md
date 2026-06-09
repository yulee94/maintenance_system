# 모바일 인증 및 저장 보안

## 로그인 흐름

```text
회사 계정 로그인
        ↓
OTP 또는 MFA
        ↓
기기 등록
        ↓
사업장/권한 확인
        ↓
앱 사용
```

## 현재 구현

- `/api/v1/login`은 모바일 전용 로그인 API다.
- `MOBILE_MFA_REQUIRED=true`이면 OTP/MFA 확인 전에는 `sessionToken`을 발급하지 않는다.
- 개발/데모 검증용 OTP는 `MOBILE_TEST_OTP_CODE`를 사용한다.
- 운영 전에는 TOTP, WebAuthn/passkey, 회사 SSO MFA 중 하나로 교체해야 한다.
- `/api/v1/devices/register`는 로그인 후 기기 등록 이벤트를 감사 로그에 남긴다.
- 모든 모바일 API는 Bearer 토큰, `X-Client-Platform`, `X-Device-Id`를 검사한다.

## 앱 내부 저장 금지 항목

앱 내부에는 다음 항목을 저장하지 않는다.

- 비밀번호 원문
- 주민등록번호
- 카드번호
- 민감정보 평문
- 관리자 토큰 장기 저장

## 암호화 저장소 사용 기준

꼭 저장해야 하는 값은 암호화 저장소만 사용한다.

| 플랫폼 | 저장소 |
| --- | --- |
| iOS | Keychain |
| Android | Keystore |
| 공통 앱 코드 | Secure Storage, `expo-secure-store` |

현재 React Native 앱은 다음 값만 SecureStore에 저장한다.

- 짧은 만료 시간의 모바일 세션 토큰
- 서버 등록용 기기 식별자

## 운영 전 필수 보완

- `TrustedDevice` 또는 `MobileDevice` 테이블 추가
- 기기 식별자 원문 저장 금지, 해시 저장
- 기기 분실/퇴사/계약 종료 시 기기 토큰 폐기
- refresh token rotation 적용
- 관리자/임원/최고관리자 MFA 필수화
- MFA 실패 감사 로그와 알림 추가
- 모바일 앱 생체인증은 편의 기능으로만 사용하고 서버 권한 검사를 대체하지 않기
