# Mobile Fastlane

정비 렌탈 운영 모바일 앱의 스토어 업로드 자동화 lane입니다.

## Lane

- `bundle exec fastlane ios beta`: IPA를 TestFlight에 업로드합니다.
- `bundle exec fastlane ios release`: 검수 완료 production IPA를 App Store Connect에 업로드합니다.
- `bundle exec fastlane android internal`: AAB를 Play Internal Testing 트랙에 업로드합니다.
- `bundle exec fastlane android production`: 검수 완료 AAB를 Play production 트랙에 업로드합니다.

## 주요 환경 변수

```text
IOS_ARTIFACT_PATH=build/maintenance.ipa
ANDROID_ARTIFACT_PATH=build/maintenance.aab
IOS_BUNDLE_ID=com.bitween.maintenance
ANDROID_PACKAGE_NAME=com.bitween.maintenance
APPLE_ID=release-manager@example.com
APPLE_TEAM_ID=...
APP_STORE_CONNECT_TEAM_ID=...
GOOGLE_PLAY_JSON_KEY_PATH=./google-play-service-account.json
SUBMIT_FOR_REVIEW=false
AUTOMATIC_RELEASE=false
```

Apple/Google 자격증명 파일은 저장소에 커밋하지 않고 CI secret 또는 배포 서버의 보안 저장소에서 주입합니다.
