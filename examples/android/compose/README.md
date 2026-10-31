# Agata Android source (compose)
Open in Android Studio with JDK 17 and Android SDK 36. Dependencies require network on first Gradle sync.
Pinned: AGP 8.13.2, Gradle 8.13, Kotlin/Compose compiler 2.2.20, Compose BOM 2025.10.01, Navigation 2.9.5.
Gradle Wrapper is included with official wrapper/distribution SHA-256 and Apache-2.0 license.
Build: `./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`). Set Android SDK location in Android Studio or local.properties.
No APK is included. Android build was not performed by the Agata exporter.
Workspace positions never become Android layout coordinates.
XML drawer/bottom/top bars use native LinearLayout panels; they are not full Material navigation widgets.
Custom source files override matching generated paths explicitly, independently per backend. They are not imported back into the visual model.
