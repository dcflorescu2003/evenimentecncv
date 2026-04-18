
## Plan: Conformitate App Store (Opțiunea B — iPhone-only)

### 1. `ios/App/App/Info.plist`
- Adaug `UIBackgroundModes` → `remote-notification` (push în background).
- Schimb `CFBundleDevelopmentRegion` din `en` → `ro`.
- Înlocuiesc `armv7` → `arm64` în `UIRequiredDeviceCapabilities`.
- **Elimin** `UISupportedInterfaceOrientations~ipad` (iPhone-only).

### 2. `ios/App/App.xcodeproj/project.pbxproj`
- Schimb `TARGETED_DEVICE_FAMILY = "1,2"` → `"1"` (iPhone-only) în ambele config (Debug + Release).

### 3. Nou `ios/App/App/PrivacyInfo.xcprivacy`
Privacy Manifest obligatoriu (mai 2024) cu declarațiile standard pentru Capacitor:
- `NSPrivacyAccessedAPICategoryUserDefaults` — reason `CA92.1`
- `NSPrivacyAccessedAPICategoryFileTimestamp` — reason `C617.1`
- `NSPrivacyAccessedAPICategorySystemBootTime` — reason `35F9.1`
- `NSPrivacyAccessedAPICategoryDiskSpace` — reason `E174.1`
- `NSPrivacyTracking` = `false`
- `NSPrivacyCollectedDataTypes` — Email, Name, User ID (toate „Linked, NOT used for tracking", purpose: App Functionality)

### 4. `ios/App/App.xcodeproj/project.pbxproj` — adaug PrivacyInfo la Resources
Adaug `PrivacyInfo.xcprivacy` în `PBXFileReference`, `PBXResourcesBuildPhase` și grupul `App` ca să fie inclus în bundle.

### 5. `APPSTORE_SUBMISSION.md` — checklist extins
Adaug secțiuni:
- **Capabilities Xcode**: Push Notifications + Background Modes → Remote notifications
- **Target device**: iPhone-only (fără screenshots iPad necesare)
- **Privacy Manifest**: inclus automat (`PrivacyInfo.xcprivacy`)
- **Privacy Nutrition Labels** (App Store Connect):
  - Contact Info → Email Address (Linked, App Functionality)
  - User Content → Other (Linked, App Functionality)
  - Identifiers → User ID (Linked, App Functionality)
  - **Tracking: No**
- **Account deletion**: confirmat — `/delete-account` accesibil din UI

### Fișiere modificate/create
1. `ios/App/App/Info.plist` — chei push + region + arch + scoatere iPad orientations
2. `ios/App/App.xcodeproj/project.pbxproj` — `TARGETED_DEVICE_FAMILY=1` + referință PrivacyInfo
3. **Nou** `ios/App/App/PrivacyInfo.xcprivacy`
4. `APPSTORE_SUBMISSION.md` — checklist actualizat

### Ce NU se schimbă
- Logică aplicație, RLS, edge functions, schema DB.
- Android (Play Store separat).
