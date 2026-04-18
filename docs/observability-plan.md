# Observability Plan

Last updated: 2026-04-18

## MVP decision

Tabbit keeps the current lightweight monitoring contract for this release-prep pass and does not wire real Amplitude or Crashlytics SDKs yet.

Reasons:

- No production Amplitude API key is available in this workspace.
- Crashlytics needs Firebase project/app confirmation and native SDK wiring per platform. Android Firebase exists for push, but iOS Firebase artifacts are not present.
- Adding analytics or crash SDKs changes the privacy policy and store data disclosures, so this should be done together with the final public privacy policy.

Current behavior:

- `src/lib/monitoring.ts` defines the event names used by the share/story-card flow.
- Development builds print events and handled errors to the console.
- Preview and production EAS profiles set `EXPO_PUBLIC_ENABLE_CRASHLYTICS=false` until a real crash backend is selected.

## Event contract

Current event names:

- `threshold_unlocked`
- `share_mode_opened`
- `share_export_started`
- `share_export_succeeded`
- `share_export_failed`
- `share_sheet_opened`
- `snapshot_saved`

Allowed context fields:

- `userId`
- `groupId`
- `tagId`
- `lifeDay`
- `exportStage`
- `reason`
- non-sensitive numeric/boolean counters

Do not add:

- raw image URLs or signed URLs
- certification photo contents
- chat message text
- Google OAuth tokens
- Supabase keys
- exact device identifiers beyond the push token flow already required for notifications

## External setup required before SDK wiring

Amplitude:

- Create or choose an Amplitude project for Tabbit.
- Decide whether analytics should be enabled for preview builds, production builds, or both.
- Add `EXPO_PUBLIC_AMPLITUDE_API_KEY` to EAS environment variables.
- Confirm the privacy policy and store data safety answers disclose analytics collection if enabled.

Crash reporting:

- Decide between Firebase Crashlytics and Sentry before adding SDK dependencies.
- If using Crashlytics, confirm Android Firebase app `com.tabbit.app` and create the iOS Firebase app if iOS is in scope.
- Add any required native config files through a secure channel. Do not commit service account private keys.
- Enable `EXPO_PUBLIC_ENABLE_CRASHLYTICS=true` only after SDK wiring is verified in a preview build.

## Preview verification

For the next preview build, check:

- share/story-card events appear in development logs during local QA
- handled export failures call `captureHandledError`
- no sensitive values are printed in release-mode logs
- no analytics/crash SDK starts without an explicit provider key or enable flag
