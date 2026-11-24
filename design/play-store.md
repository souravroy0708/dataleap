# Publishing DataLeap on Google Play: checklist

DataLeap already works for anyone: first-run setup, everything configurable, all data on the phone. Sharing the APK directly with friends works today. A Play Store release needs these steps first.

## Status in DataLeap 3.0

- Done: target API 36 (manifest and Gradle), edge-to-edge insets, predictive back, `USE_EXACT_ALARM` removed (user-granted `SCHEDULE_EXACT_ALARM` with an in-app prompt), AAB built by the GitHub workflow (`DataLeap-<version>.aab` in the run's artifacts and in each Release), privacy policy page, store listing text (`design/store-listing.md`).
- **Private access (PIN):** the app opens with a PIN screen. In Play Console → App content → **App access**, choose "All or some functionality is restricted" and give the reviewers the PIN with one line of instructions, or the review will be rejected. The PIN is a gate for friends, not security: anyone who decompiles the APK can bypass it, so never rely on it to protect secrets.
- Still yours to do: Play Console account, data safety and content rating forms, screenshots, closed test with 12+ testers for 14 days (new personal accounts), then production.

## Must do before submitting (reference)

1. **Target API 36 (Android 16).** Since 31 August 2026, new apps and updates on Google Play must target API level 36 (https://developer.android.com/google/play/requirements/target-sdk). DataLeap targets 34 today.
   - Change `targetSdk`/`compileSdk` to 36 in `android/app/build.gradle.kts` (and `--target-sdk-version` in `build.sh`).
   - From API 35, apps draw edge to edge and cannot opt out on 36. Pass the system-bar insets to the WebView (for example as CSS variables) so the header and the Motivate button are not hidden under the status and navigation bars. Test on a phone with gesture navigation and one with buttons.
   - Re-test notifications, exact alarms, the timer notification and voice input on Android 16.
2. **Exact alarms.** Play restricts `USE_EXACT_ALARM` to alarm and calendar apps. For the Play build, remove it and rely on `SCHEDULE_EXACT_ALARM`, which the user grants in Settings. DataLeap already asks for it on the Reminders page and falls back to inexact alarms (a few minutes late) if refused.
3. **Upload an Android App Bundle (AAB),** not an APK: `gradle -p android bundleRelease`, signed with your upload key; enrol in Play App Signing.
4. **Privacy policy URL:** `https://souravroy0708.github.io/dataleap/privacy.html` (already in the site).
5. **Data safety form:** no data collected, no data shared. Microphone: used only on-device for voice typing when the user taps a mic; audio not stored by the app.
6. **Permissions declarations:** microphone (voice input, user-initiated), notifications, exact alarms (reminders at the time the user chose).
7. **Store listing:** short and full description, screenshots (Today, My day, System design, Progress, setup), feature graphic, app icon 512 x 512 (already in `docs/assets/icons/icon-512.png`).
8. **Content rating** questionnaire; category: Education or Productivity; audience: adults.
9. **New personal developer accounts:** a closed test with testers for 14 days is required before production. Your friends are the perfect testers.

## Nice to have

- Remove the GitHub-Pages-specific "Download the Android app" link from the in-app Reminders page in the Play build.
- Add an in-app "What's new" note per release.
