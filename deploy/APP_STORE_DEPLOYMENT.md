# App Store & Play Store Deployment Guide for Hushh

**Status**: ✅ App configured and ready for store submission  
**App Name**: Hushh  
**Bundle ID**: com.hushh.app  
**Version**: 1.0.0  
**Build**: 1  

---

## ✅ Completed Configuration Changes

### iOS Configuration
- [x] Bundle ID updated to `com.hushh.app` in capacitor.config.ts
- [x] App name changed to "Hushh" in capacitor.config.ts and Info.plist
- [x] Version updated to 1.0.0 in package.json
- [x] App icons generated for all required iOS sizes
- [x] Project synced with Capacitor

### Android Configuration
- [x] Package name updated to `com.hushh.app` in build.gradle
- [x] Namespace updated to `com.hushh.app`
- [x] App name changed to "Hushh" in strings.xml
- [x] Version updated to 1.0.0 (versionName) and versionCode 1
- [x] Package structure migrated from `com.hushh.pda` to `com.hushh.app`
- [x] All plugin imports updated
- [x] App icons generated for all required Android sizes
- [x] Project synced with Capacitor

---

## 📱 iOS App Store Deployment

### Phase 1: Apple Developer Portal Setup

#### Step 1: Create App Identifier
1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Identifiers** → **+**
3. Select **App IDs** → Continue
4. Configure:
   - **Description**: Hushh
   - **Bundle ID**: Explicit → `com.hushh.app`
   - **Capabilities**: Enable these
     - ☑️ Associated Domains (for Firebase)
     - ☑️ Push Notifications
     - ☑️ Sign In with Apple (optional)
5. Click **Continue** → **Register**

#### Step 2: Create Distribution Certificate
1. **Certificates, Identifiers & Profiles** → **Certificates** → **+**
2. Select **Apple Distribution** → Continue
3. Create CSR:
   ```bash
   # Open Keychain Access on Mac
   # Menu: Keychain Access → Certificate Assistant → Request Certificate from Authority
   # Email: your-email@domain.com
   # Common Name: Hushh Distribution
   # Select "Saved to disk"
   # Save as: hushh_distribution.certSigningRequest
   ```
4. Upload CSR file
5. Download certificate
6. Double-click to install in Keychain

#### Step 3: Create Provisioning Profile
1. **Certificates, Identifiers & Profiles** → **Profiles** → **+**
2. Select **App Store** → Continue
3. **App ID**: Select `com.hushh.app`
4. **Certificate**: Select your Distribution certificate
5. **Profile Name**: `Hushh App Store`
6. Click **Generate** → Download
7. Double-click to install

#### Step 4: Create App Store Connect Record
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **My Apps** → **+** → **New App**
3. Configure:
   - **Platforms**: ☑️ iOS
   - **Name**: Hushh
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: Select `com.hushh.app`
   - **SKU**: `hushh-ios-2026`
   - **User Access**: Full Access
4. Click **Create**

### Phase 2: Xcode Configuration

#### Step 1: Open Project
```bash
cd /Users/kushals/Downloads/GitHub/hushh-research/hushh-webapp
open ios/App/App.xcodeproj
```

#### Step 2: Update Project Settings
In Xcode:
1. Select **App** project in navigator
2. Select **App** target
3. **General** tab:
   - **Display Name**: Hushh ✅
   - **Bundle Identifier**: com.hushh.app ✅
   - **Version**: 1.0.0 ✅
   - **Build**: 1 ✅

4. **Signing & Capabilities** tab:
   - **Team**: Select your Apple Developer team
   - **Bundle Identifier**: com.hushh.app
   - **Provisioning Profile**: Select "Hushh App Store"
   - **Signing Certificate**: Apple Distribution
   - Uncheck "Automatically manage signing" for manual control

5. **Info** tab:
   - Verify **Bundle Display Name**: Hushh ✅

#### Step 3: Update Firebase Config (If Needed)
If Firebase bundle ID needs updating:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. **Project Settings** → **Your apps** → iOS app
3. Update **Bundle ID** to `com.hushh.app`
4. Download new `GoogleService-Info.plist`
5. Replace in `ios/App/App/`
6. Update `Info.plist` reversed client ID if changed

### Phase 3: Build & Archive

#### Step 1: Clean Build
In Xcode:
- Menu: **Product** → **Clean Build Folder** (⌘⇧K)

#### Step 2: Archive
1. Select target: **Any iOS Device (arm64)**
2. Menu: **Product** → **Archive**
3. Wait for archive to complete

#### Step 3: Validate Archive
In **Organizer** (opens automatically):
1. Select your archive
2. Click **Validate App**
3. Select distribution options:
   - ☑️ Upload symbols
   - ☑️ Automatically manage version
4. Click **Validate**
5. Fix any errors, re-archive if needed

### Phase 4: Upload to App Store Connect

#### Step 1: Distribute
1. In Organizer, click **Distribute App**
2. Select **App Store Connect** → Next
3. Select **Upload** → Next
4. Distribution options:
   - ☑️ Upload symbols
   - ☑️ Automatically manage version
5. Click **Upload**
6. Wait 5-20 minutes for upload

#### Step 2: Export Compliance
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. **My Apps** → **Hushh** → **TestFlight**
3. Wait for "Processing" to complete (10-30 min)
4. If "Missing Compliance" appears:
   - Click **Manage**
   - Encryption: Yes (standard HTTPS)
   - Exempt: Yes
5. Click **Start Internal Testing**

### Phase 5: TestFlight Internal Testing

#### Add Internal Testers
1. **TestFlight** → **App Store Connect Users**
2. Click **+** to add testers
3. Testers receive email, install TestFlight app
4. No review required for internal testing
5. Max 100 testers

### Phase 6: TestFlight External Testing

#### Step 1: Add Test Information
1. **TestFlight** → **Test Information**
2. Fill in:
   - **Beta App Description**: App description
   - **Feedback Email**: support email
   - **Privacy Policy URL**: Required
   - **Test Instructions**: How to test
   - **What to Test**: Key features

#### Step 2: Submit for Beta Review
1. **TestFlight** → **External Testing** → **+**
2. **Group Name**: "Public Beta"
3. **Add Build**: Select your build
4. Click **Submit for Review**
5. Wait 24-48 hours for approval
6. Max 10,000 testers
7. Share public link after approval

### Phase 7: App Store Submission

#### Step 1: Prepare Metadata
1. **App Store** tab in App Store Connect
2. **App Information**:
   - **Subtitle**: Short tagline (30 chars)
   - **Category**: Primary & Secondary
3. **Pricing**: Free or paid
4. **Availability**: Countries

#### Step 2: Version Information
1. **App Store** → **1.0 Prepare for Submission**
2. **Screenshots** (Required):
   - 6.7" Display: 3-10 screenshots
   - 5.5" Display: 3-10 screenshots
   - Use simulator: `xcrun simctl io booted screenshot screenshot.png`
3. **Description**: Full app description
4. **Keywords**: Comma-separated (100 chars)
5. **Support URL**: Required
6. **Privacy Policy URL**: Required

#### Step 3: Submit
1. Select **Build**
2. Fill **App Review Information**
3. Add demo account if login required
4. Click **Submit for Review**
5. Wait 24-48 hours

---

## 🤖 Android Play Store Deployment

### Phase 1: Google Play Console Setup

#### Step 1: Create App
1. Go to [play.google.com/console](https://play.google.com/console)
2. Click **Create app**
3. Configure:
   - **App name**: Hushh
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free
4. Declare policies (content rating, privacy policy, etc.)
5. Click **Create app**

#### Step 2: Complete Dashboard Setup
1. **Dashboard** → Complete setup checklist:
   - App details
   - Store listing
   - Content rating
   - Target audience
   - Privacy policy
   - App access
   - Ads

### Phase 2: Build Release APK/AAB

#### Step 1: Generate Keystore (First Time Only)
```bash
cd /Users/kushals/Downloads/GitHub/hushh-research/hushh-webapp/android

# Generate release keystore
keytool -genkey -v -keystore hushh-release-key.keystore \
  -alias hushh-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Save keystore password securely!
```

#### Step 2: Configure Signing
Create `android/key.properties`:
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=hushh-key
storeFile=hushh-release-key.keystore
```

Update `android/app/build.gradle`:
```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### Step 3: Build Release AAB
```bash
cd /Users/kushals/Downloads/GitHub/hushh-research/hushh-webapp

# Build and sync
npm run cap:build
npx cap sync android

# Build release AAB
cd android
./gradlew bundleRelease

# AAB location:
# android/app/build/outputs/bundle/release/app-release.aab
```

### Phase 3: Upload to Play Console

#### Step 1: Create Internal Testing Release
1. **Play Console** → **Hushh** → **Release** → **Testing** → **Internal testing**
2. Click **Create new release**
3. Upload AAB: `app-release.aab`
4. **Release name**: 1.0.0 (1)
5. **Release notes**: Initial release
6. Click **Review release** → **Start rollout to Internal testing**

#### Step 2: Add Internal Testers
1. **Testing** → **Internal testing** → **Testers**
2. Create email list or use Google Group
3. Share opt-in URL with testers
4. No review required
5. Max 100 testers

#### Step 3: Promote to Closed Testing (Beta)
1. After internal testing, go to **Closed testing**
2. Create new release or promote from internal
3. Add test tracks
4. Submit for review
5. Wait 1-2 days for approval

#### Step 4: Production Release
1. **Release** → **Production**
2. Create new release or promote from closed testing
3. Upload or use existing AAB
4. **Release notes**: What's new
5. **Staged rollout**: 20% → 50% → 100% (recommended)
6. Click **Review release** → **Start rollout to Production**
7. Wait 1-7 days for review

### Phase 4: Play Store Listing

#### Required Assets
1. **Screenshots**:
   - Phone: Min 2, max 8 (16:9 or 9:16)
   - 7-inch tablet: Min 1 (optional)
   - 10-inch tablet: Min 1 (optional)

2. **High-res icon**: 512x512 PNG

3. **Feature graphic**: 1024x500 (required)

4. **Short description**: Max 80 chars

5. **Full description**: Max 4000 chars

6. **App category**: Choose primary category

7. **Contact details**: Email, website, privacy policy

---

## 🔄 Update Checklist for Future Builds

### Version Bump
```bash
# Update version in package.json
# Update versionCode and versionName in android/app/build.gradle
# Update version and build in Xcode
```

### iOS Update
```bash
cd /Users/kushals/Downloads/GitHub/hushh-research/hushh-webapp
npm run cap:build
npx cap sync ios
open ios/App/App.xcodeproj
# Archive → Validate → Upload
```

### Android Update
```bash
cd /Users/kushals/Downloads/GitHub/hushh-research/hushh-webapp
npm run cap:build
npx cap sync android
cd android
./gradlew bundleRelease
# Upload AAB to Play Console
```

---

## 📋 Important Files & Locations

### iOS
- **Project**: `ios/App/App.xcodeproj`
- **Info.plist**: `ios/App/App/Info.plist`
- **Icons**: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- **Splash**: `ios/App/App/Assets.xcassets/Splash.imageset/`

### Android
- **Project**: `android/`
- **Build Config**: `android/app/build.gradle`
- **Manifest**: `android/app/src/main/AndroidManifest.xml`
- **Strings**: `android/app/src/main/res/values/strings.xml`
- **Icons**: `android/app/src/main/res/mipmap-*/`
- **Source**: `android/app/src/main/java/com/hushh/app/`

### Shared
- **Capacitor Config**: `capacitor.config.ts`
- **Package**: `package.json`
- **Assets**: `assets/` (source icons)

---

## 🚨 Important Notes

### Firebase Configuration
- If you change bundle ID, update Firebase:
  - iOS: Download new `GoogleService-Info.plist`
  - Android: Download new `google-services.json`
  - Update OAuth redirect URLs

### Code Signing
- **iOS**: Keep your distribution certificate and provisioning profiles backed up
- **Android**: NEVER lose your keystore file or passwords - you cannot update the app without them!

### Store Reviews
- **iOS**: 24-48 hours average, can take up to 7 days
- **Android**: 1-7 days average
- Both may reject for policy violations - read guidelines carefully

### Testing
- Test on real devices before submission
- Use TestFlight/Internal Testing extensively
- Check all native features (camera, location, file access, etc.)

---

## 📞 Support Resources

- **Apple Developer**: https://developer.apple.com/support/
- **Google Play Console**: https://support.google.com/googleplay/android-developer
- **Capacitor Docs**: https://capacitorjs.com/docs
- **Firebase Console**: https://console.firebase.google.com

---

**Last Updated**: January 12, 2026  
**App Version**: 1.0.0  
**Build**: 1
