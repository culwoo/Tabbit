# Release Readiness

Last updated: 2026-04-16

## Implemented in code

- Share flow now uses `Group Detail > Tag Screen > Share Mode` instead of a separate server-rendered card.
- Share CTA is always visible on the group tag screen and stays disabled until the threshold is unlocked.
- Share Mode exports a fixed-ratio 9:16 image on-device using `react-native-view-shot`.
- Save flow writes the exported image to the device media library.
- Share flow saves first, then opens the OS share sheet.
- Calendar and date detail screens distinguish `threshold unlocked` from `snapshot saved`.
- Archived entries can reopen Share Mode through the original group route with `groupId + tagId + lifeDay`.

## Data and telemetry scaffolding

- `ThresholdState` now carries `groupId`, `tagId`, `lifeDay`, `achievedCount`, `threshold`, `status`, `unlockedAt`, `archivedAt`.
- `StoryShareSnapshot` now represents the exported artifact metadata instead of a prebuilt story card.
- Group read models expose `shareEnabled`, `shareProgressLabel`, `shareCtaStyle`, `shareArchiveAvailable`.
- Analytics event names are fixed in `src/lib/monitoring.ts`:
  - `threshold_unlocked`
  - `share_mode_opened`
  - `share_export_started`
  - `share_export_succeeded`
  - `share_export_failed`
  - `share_sheet_opened`
  - `snapshot_saved`
- Monitoring wrappers currently log to console in development. Real Amplitude and Crashlytics project wiring is still required before release.

## Environment

- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_AMPLITUDE_API_KEY`
- `EXPO_PUBLIC_ENABLE_CRASHLYTICS`

## Android release checklist

- Confirm `app.json` identifiers stay on `Tabbit` / `com.tabbit.app`.
- Replace placeholder icons, splash, screenshots, and Play Store copy with final assets.
- Connect real Amplitude and Crashlytics projects and verify live data from a preview build.
- Verify media-library permissions on Android 13+ for save and re-share flow.
- Run a closed testing build and cover:
  - locked CTA render
  - unlock to Share Mode transition
  - save only
  - save + share sheet
  - export failure retry
  - archived replay from calendar/date detail

## iOS smoke checklist

- Verify login, upload, group tag screen, Share Mode safe area, and share sheet behavior.
- Confirm `bundleIdentifier` stays aligned with `com.tabbit.app`.
- Recheck photo-library permission copy before TestFlight or App Store submission.

## Remaining work before store submission

- Replace the in-memory story share store with real backend-backed threshold/archive data.
- Persist saved snapshot metadata outside the app session.
- Wire real Amplitude and Crashlytics SDK initialization.
- Prepare privacy policy, store listing copy, and final marketing screenshots.
