# DataLeap for Android

The DataLeap app: the same screens as the website, plus real Android features.

| Feature | How |
| --- | --- |
| Reminders that fire with the app closed | `AlarmManager` exact alarms (`setExactAndAllowWhileIdle`), rescheduled after every fire, reboot, update and clock change |
| Smart skipping | A reminder stays quiet when that part of the day is done, on rest days, and once the day is complete; "last call" fires only on unfinished days |
| Motivating text | Every reminder carries a quote, personalised with your daughter's name; comeback lines after a missed day, family lines after 8 pm |
| Notification actions | **Start system design** / **Start DSA** opens the app and starts the timer on today's item; **Snooze 30 min** |
| Live timer | Ongoing notification with a running clock; a "Target reached" alert at your daily target, even if the app is closed |
| Morning motivation | 3 or 4 notifications a day at varied times between 06:00 and 14:00 (you choose count and window), a quote plus today's item; stops once the day is complete; never within 20 minutes of a reminder |
| Weekly summary | Sunday 7 pm: hours, complete days and streak, with a line for the week ahead |
| Celebrations | Streak milestones, level-ups and completed days as notifications |
| Backups | Export saves to `Downloads/DataLeap/`; import uses the system file picker |
| Privacy | All data stays on the phone. No accounts, no analytics, no third-party libraries |

## How it is built

- **Native layer (Java, Android framework only):** `MainActivity`, `Bridge` (exposed to the UI as `window.AndroidBridge`), `Scheduler`, `SchedulePlan` (pure scheduling maths, self-tested), `Motivation` + `MotivationReceiver`, `Notifier`, `ReminderReceiver`, `TimerReceiver`, `ActionReceiver`, `BootReceiver`, `Store`.
- **UI:** the website from `docs/`, bundled in `app/src/main/assets/www/` and served from a private `https://dataleap.app.local/` origin inside a WebView. External links (NeetCode, Aced, YouTube) open in your browser.
- minSdk 29 (Android 10), targetSdk 34.

## Build

**Option A, GitHub Actions (automatic, same as Kharcha Check and Bas 1 Minute):**
1. Add `ci/android-apk.yml` as `.github/workflows/android-apk.yml` through GitHub's website (Add file → Create new file, paste). GitHub does not let workflows create workflow files, so this one step is manual.
2. Add the 4 secrets from `secrets-for-github.txt` in your private key zip (Settings → Secrets and variables → Actions). Laptop alternative: `./scripts/setup-signing.sh path/to/dataleap-release.jks`.
3. Every upload of `dataleap.zip`, every change under `android/` or `docs/`, or **Run workflow** in the Actions tab then: self-tests the scheduling maths, bundles the website, builds and signs the APK, runs a privacy gate, uploads the APK as an artifact and publishes a GitHub Release.
4. Install from `https://github.com/souravroy0708/dataleap/releases/latest/download/DataLeap.apk` (also linked on the site's Reminders page). Versions: `appVersion` in `app/build.gradle.kts` + run number.

**Option B, no Android Studio (Linux):**
```
sudo apt install openjdk-17-jdk-headless aapt dalvik-exchange zipalign apksigner
./build.sh                     # output: app/build/dataleap.apk
VERSION_CODE=2 VERSION_NAME=1.0.1 ./build.sh   # for an update
```
`build.sh` copies the website from `../docs` into the app, compiles, dexes, aligns and signs.

**Option C, Android Studio:** open this folder, let it sync (Gradle 8.7, AGP 8.5), then Build → Generate Signed App Bundle / APK. Run step 1 of `build.sh` (or copy `../docs` into `app/src/main/assets/www/`) after changing the website.

## Signing

Updates must be signed with the same key as the installed app. The keystore is **not** in this public repo. Keep `dataleap-release.jks` from your private signing-key zip in `keystore/` locally (it is git-ignored).

## Next steps

Move screens to Kotlin + Jetpack Compose one at a time in Android Studio; the native alarm, notification and storage classes stay as they are.
