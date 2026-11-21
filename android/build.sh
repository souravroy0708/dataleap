#!/usr/bin/env bash
# Builds and signs app/build/dataleap.apk without Gradle.
# Needs: JDK 17, aapt, dalvik-exchange (dx), zipalign, apksigner (Ubuntu: apt install openjdk-17-jdk-headless aapt dalvik-exchange zipalign apksigner)
set -euo pipefail
cd "$(dirname "$0")"
JAR=${ANDROID_JAR:-tools/android-34.jar}
if [ ! -f "$JAR" ]; then mkdir -p tools; curl -fsSL -o "$JAR" https://raw.githubusercontent.com/Sable/android-platforms/master/android-34/android.jar; fi
WEB=${WEB_DIR:-../docs}
KS=${KEYSTORE:-keystore/dataleap-release.jks}
KS_PASS=${KS_PASS:-dataleap-2026}
VERSION_CODE=${VERSION_CODE:-2}
VERSION_NAME=${VERSION_NAME:-1.1.2}
M=app/src/main
OUT=app/build

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

# 1. Web UI into assets (the website, minus the service worker which the app does not need)
rm -rf "$M/assets/www" && mkdir -p "$M/assets/www"
cp -r "$WEB"/. "$M/assets/www/"
rm -f "$M/assets/www/sw.js" "$M/assets/www/.nojekyll"
rm -rf "$M/assets/www/course" "$M/assets/www/download"   # never bundle paid course copies or the APK itself

# 2. Resources + manifest (Gradle sets the package from "namespace"; aapt needs it in the manifest)
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android"#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="io.github.souravroy0708.dataleap"#' "$M/AndroidManifest.xml" > "$OUT/AndroidManifest.xml"
aapt package -f -m -J "$OUT/gen" -M "$OUT/AndroidManifest.xml" -S "$M/res" -A "$M/assets" -I "$JAR" \
  --min-sdk-version 29 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -F "$OUT/app.unsigned.apk"

# 3. Self-test of the scheduling maths (plain JVM), then Java -> classes -> dex
rm -rf "$OUT/selftest" && mkdir -p "$OUT/selftest"
javac -nowarn -d "$OUT/selftest" "$M/java/io/github/souravroy0708/dataleap/SchedulePlan.java" app/src/test/java/io/github/souravroy0708/dataleap/SelfTest.java
java -cp "$OUT/selftest" io.github.souravroy0708.dataleap.SelfTest
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$JAR" -d "$OUT/classes" \
  $(find "$M/java" "$OUT/gen" -name '*.java')
dalvik-exchange --dex --min-sdk-version=26 --output="$OUT/dex/classes.dex" "$OUT/classes"
(cd "$OUT/dex" && aapt add ../app.unsigned.apk classes.dex >/dev/null)

# 4. Align and sign (v1 + v2 + v3)
zipalign -f -p 4 "$OUT/app.unsigned.apk" "$OUT/app.aligned.apk"
apksigner sign --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --ks "$KS" --ks-key-alias dataleap --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" --out "$OUT/dataleap.apk" "$OUT/app.aligned.apk"
apksigner verify --verbose "$OUT/dataleap.apk" | head -5
echo "Built $OUT/dataleap.apk ($VERSION_NAME, code $VERSION_CODE)"
