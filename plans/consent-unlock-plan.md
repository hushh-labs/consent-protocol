# Biometric Unlock Feature Plan

## Overview
Implement biometric unlock (Face ID/Touch ID/Android Biometrics) as the Vault Unlock mechanism in the Tri-Flow architecture.

## Architecture Flow

```
User Action → Biometric Auth → Vault Unlock (Decrypts vault key)
      ↓
VAULT Owner Token → Data Access
```

## Implementation Steps

### Phase 1: Backend (consent-protocol)

1. Create biometric unlock endpoint
   - Path: `consent-protocol/api/routes/biometrics.py`
   - Endpoint: `POST /api/biometrics/unlock`
   - Request: `{ "biometric_hash": string }`
   - Response: `{ "vault_owner_token": string }`

2. Create biometric service
   - Path: `consent-protocol/hushh_mcp/services/biometrics_service.py`
   - Functions:
     - `validate_biometric(user_id, biometric_hash)`
     - `generate_vault_owner_token(user_id)`

3. Update vault unlock flow
   - Path: `consent-protocol/hushh_mcp/services/vault_service.py`
   - Add biometric unlock method
   - Verify biometric hash before returning vault owner token

### Phase 2: Web Proxy (hushh-webapp)

1. Create biometric API route
   - Path: `hushh-webapp/app/api/biometrics/unlock/route.ts`

2. Create biometric service
   - Path: `hushh-webapp/lib/services/biometrics-service.ts`

### Phase 3: iOS Native Plugin

1. Create biometric plugin
   - Path: `hushh-webapp/ios/App/App/Plugins/BiometricPlugin.swift`
   - Methods:
     - `canCheckBiometrics() → boolean`
     - `evaluateBiometric() → { success, error }`

2. Register plugin
   - Path: `hushh-webapp/ios/App/App/MyViewController.swift`

### Phase 4: Android Native Plugin

1. Create biometric plugin
   - Path: `hushh-webapp/android/.../plugins/BiometricPlugin.kt`

2. Register plugin
   - Path: `hushh-webapp/android/.../MainActivity.kt`

### Phase 5: Component Integration

1. Create unlock button component
   - Path: `hushh-webapp/components/vault/BiometricUnlockButton.tsx`
   - Features:
     - Check biometric availability
     - Show unlock button if available
     - Call service on tap

## Security Requirements

1. Biometric hash stored in Keychain (iOS) / Keystore (Android)
2. Vault key never leaves device
3. VAULT_OWNER token issued only after successful biometric auth
4. Token expires after inactivity (configurable)

## Testing Checklist

- [ ] Biometric availability check works
- [ ] Face ID/Touch ID prompts correctly
- [ ] Android biometric prompt appears
- [ ] Vault owner token generated after success
- [ ] Token validation passes in protected endpoints
- [ ] Fallback to passcode on biometric failure