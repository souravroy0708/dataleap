plugins { id("com.android.application") }

// Release signing comes from GitHub secrets (DL_KEYSTORE_BASE64 is decoded by the workflow into DL_KEYSTORE_PATH).
// Without them the build falls back to the debug key, which cannot update an installed release build.
val releaseKeystore: String? = System.getenv("DL_KEYSTORE_PATH")
// Every build gets a higher versionCode: the GitHub run number. Bump appVersion for bigger releases.
val buildNumber: Int = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull()?.plus(100) ?: 2   // +100 keeps CI builds above any locally built APK
val appVersion = "3.3"

android {
    namespace = "io.github.souravroy0708.dataleap"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.souravroy0708.dataleap"
        minSdk = 29
        targetSdk = 36
        versionCode = buildNumber
        versionName = "$appVersion.$buildNumber"
    }

    signingConfigs {
        create("release") {
            if (releaseKeystore != null) {
                storeFile = file(releaseKeystore)
                storePassword = System.getenv("DL_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("DL_KEY_ALIAS")
                keyPassword = System.getenv("DL_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (releaseKeystore != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}
// No dependencies: the app uses only the Android framework.
