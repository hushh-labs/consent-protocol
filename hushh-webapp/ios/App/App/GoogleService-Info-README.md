# Firebase iOS Configuration Guide

## Overview

This file should contain your Firebase iOS configuration downloaded from the Firebase Console.

## How to Get GoogleService-Info.plist

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon → Project Settings
4. Scroll to "Your apps" section
5. Select your iOS app (or create one if it doesn't exist)
6. Download `GoogleService-Info.plist`
7. Replace this file with the downloaded file

## Important Notes

- **DO NOT commit this file to version control** (it's in .gitignore)
- Each environment (dev/staging/prod) should have its own Firebase project
- The file contains sensitive API keys and should be kept secure

## Required Configuration

The file should contain:

- `GOOGLE_APP_ID`
- `GCM_SENDER_ID`
- `API_KEY`
- `PROJECT_ID`
- `BUNDLE_ID`
- And other Firebase configuration values

## Testing

After adding this file:

1. Run `npx cap sync ios`
2. Open the project in Xcode
3. Verify the file is in the project navigator
4. Build and run on simulator
5. Check console for Firebase initialization logs
