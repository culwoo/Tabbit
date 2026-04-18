# Release Readiness

Last updated: 2026-04-18

## Implemented in code

- Share flow uses `Group Detail > Tag Screen > Share Mode`.
- Share CTA is visible on the group tag screen and stays disabled until the threshold is unlocked.
- Share Mode exports a fixed-ratio 9:16 image on-device using `react-native-view-shot`.
- Save flow writes the exported image to the device media library.
- Share flow saves first, then opens the OS share sheet.
- Snapshot export/share metadata is persisted to `story_cards` through the `save_story_card_snapshot` RPC.
- Calendar and date detail screens distinguish `threshold unlocked` from `snapshot saved`.
- Archived entries can reopen Share Mode through the original group route with `groupId + tagId + lifeDay`.
- Push notifications are wired for Android through Expo Push, Supabase delivery queue, and the deployed `send-push-notifications` Edge Function.

## Release config

- Public app version: `1.0.0`.
- Android `versionCode`: `1`.
- iOS `buildNumber`: `1`.
- EAS `appVersionSource`: `local`.
- EAS preview profile builds an internal Android APK.
- EAS production profile builds an Android App Bundle.
- `runtimeVersion.policy` is `appVersion`.
- `userInterfaceStyle` is locked to `light` until the explicit dark-mode task is done.
- iOS tablet support is disabled until tablet QA and iPad screenshots are ready.

## Assets

Generated launcher/splash assets:

- `assets/images/icon.png`
- `assets/images/android-icon-background.png`
- `assets/images/android-icon-foreground.png`
- `assets/images/android-icon-monochrome.png`
- `assets/images/splash-icon.png`
- `assets/images/favicon.png`
- Native Android launcher/splash resources under `android/app/src/main/res`

Generated store asset:

- `assets/store/play-feature-graphic.png`

Regenerate them with:

```bash
npm run release:assets
```

See `docs/store-assets.md` for listing copy, screenshot capture list, store requirements, and external tasks.

## Data and telemetry scaffolding

- Analytics event names are fixed in `src/lib/monitoring.ts`.
- Monitoring wrappers currently provide a contract and development logging only.
- Real Amplitude and Crashlytics/Sentry SDKs are intentionally not wired in this pass because provider accounts, production keys, privacy disclosures, and iOS artifacts are not finalized.
- EAS preview/production profiles keep `EXPO_PUBLIC_ENABLE_CRASHLYTICS=false`.

See `docs/observability-plan.md` for the provider decision, event contract, and setup checklist.

## Validation checklist

Run before a preview build:

```bash
npm run release:check
npx expo export --platform android --clear
cd android && gradlew.bat assembleDebug --console plain --stacktrace
```

Run a preview build when logged in to Expo/EAS:

```bash
npm run build:preview:android
```

Closed testing QA should cover:

- Google login and OAuth return
- camera capture and image upload
- personal-space-only upload
- group tag upload
- threshold unlock and story-card visibility
- save only
- save plus system share sheet
- export failure retry
- push notification receipt in foreground and background
- notification tap routing for group/chat/story payloads
- calendar/date detail replay of saved story cards

## External tasks

- Host the privacy policy draft from `docs/privacy-policy-draft.md` as a public web page after review.
- Create Google Play Console app listing and upload store assets.
- Decide store developer name, support email, and privacy policy URL.
- Capture final phone screenshots from a preview build.
- Create Amplitude and crash reporting projects only if the first launch will include real SDK telemetry.
- If iOS is included, create App Store Connect/Firebase iOS app records and add iOS QA/screenshots.
