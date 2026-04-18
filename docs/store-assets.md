# Store Assets

Last updated: 2026-04-18

## Generated assets in this repo

Launcher and splash:

- `assets/images/icon.png` - 1024 x 1024 app icon
- `assets/images/android-icon-background.png` - 512 x 512 adaptive icon background
- `assets/images/android-icon-foreground.png` - 512 x 512 adaptive icon foreground
- `assets/images/android-icon-monochrome.png` - 432 x 432 Android themed icon
- `assets/images/splash-icon.png` - 1024 x 1024 transparent splash mark
- `assets/images/favicon.png` - 48 x 48 web favicon
- `android/app/src/main/res/**/ic_launcher*.png` and `splashscreen_logo.png` - native Android resources generated from the same source assets

Store listing:

- `assets/store/play-feature-graphic.png` - 1024 x 500 Google Play feature graphic

Regenerate with:

```bash
npm run release:assets
```

## Current app config policy

- Public app version: `app.json` `expo.version`, currently `1.0.0`.
- Android binary version: `android.versionCode`, currently `1`.
- iOS binary version: `ios.buildNumber`, currently `1`.
- Increment `versionCode` and `buildNumber` for every binary uploaded to a store or testing track.
- Keep `package.json` `version` aligned with `app.json` `expo.version`.
- `runtimeVersion.policy` is `appVersion`, so a public app version change also creates a new update runtime boundary.
- `userInterfaceStyle` is `light` because dark mode is explicitly a later task.

## Google Play listing draft

App name:

- Tabbit

Short description:

- 친구들과 함께 인증하고, 달성한 하루를 스토리로 공유하세요.

Full description draft:

```text
Tabbit은 친구들과 같은 태그로 하루의 작은 습관을 인증하고, 함께 달성한 순간을 9:16 스토리 카드로 저장하고 공유하는 앱입니다.

운동, 공부, 기상, 루틴처럼 혼자 하면 흐려지는 목표를 그룹으로 묶어 보세요. 각자 사진으로 인증하면 그룹 태그의 달성률이 채워지고, 기준 인원이 모이면 공유 가능한 스토리 카드가 열립니다.

주요 기능
- Google 계정으로 간편 로그인
- 개인공간 태그와 그룹 태그를 분리해 인증 관리
- 사진 인증과 그룹별 임계값 달성
- 달성 순간의 푸시 알림
- 그룹 인증 스토리 카드 저장 및 시스템 공유
- 캘린더에서 개인 기록과 그룹 달성 기록 확인

Tabbit은 과시보다 “우리 같이 해냈다”는 기록에 집중합니다.
```

## Screenshot capture list

Use actual app screens from a logged-in preview build. Avoid mock-only screens.

Recommended first Android phone screenshots:

- Home with active groups and today's progress
- Camera/share target selection with personal and group tags
- Group detail with a locked or progressing tag
- Group detail Share Mode after threshold unlock
- Calendar/date detail showing saved story and personal certifications
- Personal space with tag filter and certification history

Google Play official requirements currently include at least two screenshots across device types, JPEG or 24-bit PNG without alpha, 320-3840 px dimensions, and max dimension no more than twice the min dimension. For stronger placement, Google recommends at least four app screenshots at minimum 1080 px resolution, using 9:16 portrait at 1080 x 1920 or above for portrait phone screenshots.

Reference: https://support.google.com/googleplay/android-developer/answer/9866151

## App Store notes

iOS is not the current verified platform, but `app.json` keeps `bundleIdentifier=com.tabbit.app` and `ios.buildNumber=1`.

Apple currently requires one to ten screenshots per supported display set. Because Tabbit is phone-first and `supportsTablet=false`, do not claim iPad support until tablet QA and iPad screenshots are ready.

Reference: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/

## Privacy and data safety inputs

Prepare a public privacy policy URL before submitting to Google Play or App Store Connect.

Tabbit's current likely disclosure categories:

- Account/profile data from Google sign-in
- User-generated certification photos and captions
- Group membership, group tags, personal tags, chat messages, and notification records
- Push notification token and installation identifier
- Optional analytics/crash diagnostics only if a real SDK is enabled later

Google Play Data safety and Apple App Privacy answers must be updated if Amplitude, Crashlytics, Sentry, ads, attribution SDKs, or payment SDKs are added.

References:

- https://developer.android.com/privacy-and-security/declare-data-use
- https://developer.apple.com/app-store/app-privacy-details/

## External work needed

- Create or confirm Google Play Console developer account and app record.
- Host the privacy policy at a public, non-PDF URL.
- Decide support contact email and developer display name for store metadata.
- Capture final screenshots from a preview build on a real or representative Android device.
- If iOS is in scope, create the App Store Connect app record and capture required iPhone screenshots.
