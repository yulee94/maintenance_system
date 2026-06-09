# App Store Review Checklist

정비 렌탈 운영 모바일 앱을 TestFlight, Play Internal Testing, App Store, Google Play에 제출하기 전에 확인하는 심사용 패키지 기준입니다.

## 필수 제출 자료

| 항목 | 준비 위치 | 제출 전 확인 |
| --- | --- | --- |
| 테스트 계정 | `mobile/release/store-metadata/ko-KR/review-package.json` | staging API에서 실제 로그인 가능 |
| 테스트 사업장 데이터 | `mobile/release/store-metadata/ko-KR/test-branches.json` | 미결, 진행, 완료, 승인 대기, 반려 예시 포함 |
| 개인정보 처리방침 URL | `/privacy`, `APP_PRIVACY_POLICY_URL` | 실제 공개 URL로 교체 |
| 이용약관 URL | `/terms`, `APP_TERMS_URL` | 실제 공개 URL로 교체 |
| 고객센터 연락처 | `/support`, `APP_SUPPORT_EMAIL`, `APP_SUPPORT_PHONE` | 운영 담당 연락처로 교체 |
| 앱 설명 | `mobile/release/store-metadata/ko-KR/app-listing.md` | 스토어 콘솔 문구와 일치 |
| 스크린샷 | `mobile/release/screenshots/ko-KR/` | 실제 staging 빌드 기준 최종 캡처로 교체 |
| 앱 아이콘 | `mobile/assets/icon.png` | iOS 투명도 없음, Android adaptive icon 확인 |
| 권한 사용 사유 | `mobile/release/store-metadata/ko-KR/permission-rationales.md` | OS 권한 문구와 화면 안내 문구 일치 |

## 테스트 계정

스토어 심사 메모에는 반드시 로그인 가능한 계정을 제공합니다. 계정은 production 실사용 계정이 아니라 staging 심사용 계정으로 운영합니다.

| 역할 | 아이디 | 비밀번호 | 확인 기능 |
| --- | --- | --- | --- |
| 최고관리자/관리자 | `ko.ms` | `Admin!2026Test` | 계정/권한, 작업 배정, 승인, KPI, 보고서 |
| 임원 | `kim.ms` | `Exec!2026Test` | KPI, 경영 보고, 최종 승인 |
| 사업장 관리자 | `son.hn` | `Admin2!2026Test` | 작업 배정, 계획업무 승인/반려 |
| 정비사 | `jegal.ts` | `Mech!2026Test` | 오늘 업무, 정비건, 완료보고, AI |
| 접수자 | `park.jw` | `Reception!2026` | 접수/현황 확인 |

MFA가 켜져 있으면 심사 메모에 OTP 방식과 임시 OTP를 함께 제공합니다. `MOBILE_TEST_OTP_CODE`는 dev/staging 전용으로만 사용하고 production에서는 정식 MFA 제공자로 교체합니다.

## 테스트 사업장 데이터

심사자가 기능을 확인할 수 있도록 최소 1개 이상의 다음 데이터가 staging에 있어야 합니다.

- 미결 정비건
- 진행 중 정비건
- 완료보고 제출 건
- 관리자 승인 대기 건
- 임원 최종승인 대기 건
- 반려 또는 수정 요청 건
- 사진 첨부 예시
- AI 권한 차단 예시

## 개인정보 처리방침과 이용약관

정식 제출 전 `/privacy`, `/terms`, `/support`, `/app-review`를 운영 도메인에 배포하고, 스토어 콘솔의 URL도 같은 주소로 설정합니다.

개인정보 처리방침 필수 항목:

- 처리 목적
- 수집 항목
- 보유기간과 파기 기준
- 제3자 제공과 위탁
- 국외 이전 여부
- 안전성 확보조치
- 개인정보 보호책임자와 문의처

## 권한 사용 사유

| 권한 | 사용 이유 | 요청 시점 |
| --- | --- | --- |
| 푸시 알림 | 작업 배정, 승인 요청, 공지, 장애, 입고/출고, 예약, 정산 알림 | 로그인 후 알림 수신 안내 시 |
| 카메라 | 완료보고에서 장비 상태, 고장 부위, 교체 부품 사진 촬영 | 완료보고 첨부 버튼 사용 시 |
| 사진 보관함 | 기존 현장 사진 또는 동영상 첨부 | 완료보고 첨부 버튼 사용 시 |
| 위치 | 현재 앱에서는 직접 수집하지 않음 | 기능 추가 전 별도 검토 필요 |

## 빈 화면과 오류 방지 Smoke Test

제출 전 다음 항목을 실제 staging 앱에서 확인합니다.

- 앱 첫 실행 후 로그인 화면 표시
- 모든 심사용 계정 로그인 가능
- 오늘, 정비건, 완료건, AI 탭 진입 가능
- 정비건 상세와 완료보고 화면 진입 가능
- 네트워크 오류 시 빈 화면 대신 오류/재시도 안내 표시
- 권한 없는 KPI/계정/감사 자료 요청 시 AI가 차단 메시지 표시
- 푸시 권한 거절 시 앱이 종료되지 않음
- 오프라인 큐 복구 후 중복 요청 없이 동기화
- Crashlytics 또는 Sentry에서 staging 빌드 이벤트 수집 확인

## 결제 정책

현재 앱은 소비자 대상 인앱 결제, 디지털 콘텐츠 판매, 카드번호 입력, 결제수단 등록 기능을 제공하지 않습니다. 결제/정산 알림은 내부 업무용 알림입니다.

향후 결제 기능 추가 전에는 Apple/Google 결제 정책, PG 계약, 전자금융 관련 법규, 개인정보 위탁과 보관 기준을 별도 검토합니다.
