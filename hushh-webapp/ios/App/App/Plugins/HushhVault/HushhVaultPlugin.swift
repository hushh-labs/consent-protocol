//
//  HushhVaultPlugin.swift
//  App
//
//  Hushh Vault - Encrypted Storage Plugin
//  Port of lib/vault/encrypt.ts with AES-256-GCM encryption
//
//  Uses CryptoKit for:
//  - PBKDF2 key derivation (100,000 iterations, SHA-256)
//  - AES-256-GCM encryption (12-byte nonce, 128-bit tag)
//
//  Cloud DB Access:
//  - Calls consent-protocol Cloud Run backend for vault operations
//

import Foundation
import Capacitor
import CryptoKit

// MARK: - Constants

private let PBKDF2_ITERATIONS = 100_000
private let KEY_SIZE_BYTES = 32      // 256 bits
private let SALT_SIZE_BYTES = 16     // 128 bits
private let NONCE_SIZE_BYTES = 12    // 96 bits (as per NIST recommendation)

// Cloud Run Backend URL for vault operations
private let CLOUD_BACKEND_URL = "https://consent-protocol-1006304528804.us-central1.run.app"

// MARK: - Plugin

@objc(HushhVaultPlugin)
public class HushhVaultPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HushhVaultPlugin"
    public let jsName = "HushhVault"
    public let pluginMethods: [CAPPluginMethod] = [
        // Crypto methods
        CAPPluginMethod(name: "deriveKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "encryptData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decryptData", returnType: CAPPluginReturnPromise),
        // Cloud DB methods (uses VaultStorageManager for cloud/local abstraction)
        CAPPluginMethod(name: "hasVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setupVault", returnType: CAPPluginReturnPromise),
        // Local storage stubs
        CAPPluginMethod(name: "storePreference", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deletePreferences", returnType: CAPPluginReturnPromise),
    ]
    
    // MARK: - Cloud DB: Has Vault Check
    
    /// Check if user has a vault
    /// Uses VaultStorageManager which routes to cloud or local storage
    @objc func hasVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        // Update auth token if provided
        if let authToken = call.getString("authToken") {
            VaultStorageManager.shared.setAuthToken(authToken)
        }
        
        Task {
            do {
                let exists = try await VaultStorageManager.shared.getStorage().hasVault(userId: userId)
                call.resolve(["exists": exists])
            } catch {
                call.reject("Failed to check vault: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Cloud DB: Get Vault Data
    
    /// Get encrypted vault key
    /// Uses VaultStorageManager for cloud/local abstraction
    @objc func getVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        if let authToken = call.getString("authToken") {
            VaultStorageManager.shared.setAuthToken(authToken)
        }
        
        Task {
            do {
                let data = try await VaultStorageManager.shared.getStorage().getVault(userId: userId)
                call.resolve([
                    "authMethod": data.authMethod,
                    "encryptedVaultKey": data.encryptedVaultKey,
                    "salt": data.salt,
                    "iv": data.iv,
                    "recoveryEncryptedVaultKey": data.recoveryEncryptedVaultKey,
                    "recoverySalt": data.recoverySalt,
                    "recoveryIv": data.recoveryIv
                ])
            } catch CloudDBError.notFound {
                call.reject("Vault not found", "NOT_FOUND")
            } catch {
                call.reject("Failed to get vault: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Cloud DB: Setup Vault
    
    /// Store encrypted vault key
    /// Uses VaultStorageManager for cloud/local abstraction
    @objc func setupVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let encryptedVaultKey = call.getString("encryptedVaultKey"),
              let salt = call.getString("salt"),
              let iv = call.getString("iv"),
              let recoveryEncryptedVaultKey = call.getString("recoveryEncryptedVaultKey"),
              let recoverySalt = call.getString("recoverySalt"),
              let recoveryIv = call.getString("recoveryIv") else {
            call.reject("Missing required parameters")
            return
        }
        
        if let authToken = call.getString("authToken") {
            VaultStorageManager.shared.setAuthToken(authToken)
        }
        
        let data = VaultKeyInfo(
            authMethod: call.getString("authMethod") ?? "passphrase",
            encryptedVaultKey: encryptedVaultKey,
            salt: salt,
            iv: iv,
            recoveryEncryptedVaultKey: recoveryEncryptedVaultKey,
            recoverySalt: recoverySalt,
            recoveryIv: recoveryIv
        )
        
        Task {
            do {
                try await VaultStorageManager.shared.getStorage().setupVault(userId: userId, data: data)
                call.resolve(["success": true])
            } catch {
                call.reject("Failed to setup vault: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Derive Key
    
    /// Derive an encryption key from passphrase using PBKDF2
    /// Mirrors: PBKDF2 key derivation in encrypt.ts
    ///
    /// Parameters:
    /// - iterations: 100,000 (matches config.py)
    /// - hash: SHA-256
    /// - keyLength: 256 bits (32 bytes, output as 64-char hex)
    @objc func deriveKey(_ call: CAPPluginCall) {
        guard let passphrase = call.getString("passphrase") else {
            call.reject("Missing required parameter: passphrase")
            return
        }
        
        let iterations = call.getInt("iterations") ?? PBKDF2_ITERATIONS
        
        // Generate or use provided salt
        let saltBytes: Data
        if let saltHex = call.getString("salt") {
            saltBytes = Data(hexString: saltHex) ?? Data()
            if saltBytes.isEmpty {
                call.reject("Invalid salt hex string")
                return
            }
        } else {
            var randomBytes = [UInt8](repeating: 0, count: SALT_SIZE_BYTES)
            _ = SecRandomCopyBytes(kSecRandomDefault, SALT_SIZE_BYTES, &randomBytes)
            saltBytes = Data(randomBytes)
        }
        
        // Derive key using PBKDF2 with CommonCrypto
        guard let derivedKey = pbkdf2Derive(
            password: passphrase,
            salt: saltBytes,
            iterations: iterations,
            keyLength: KEY_SIZE_BYTES
        ) else {
            call.reject("Key derivation failed")
            return
        }
        
        // Convert to hex strings
        let keyHex = derivedKey.map { String(format: "%02x", $0) }.joined()
        let saltHex = saltBytes.map { String(format: "%02x", $0) }.joined()
        
        call.resolve([
            "keyHex": keyHex,
            "salt": saltHex
        ])
    }
    
    // MARK: - Encrypt Data
    
    /// Encrypt data using AES-256-GCM
    /// Mirrors: encryptData() in encrypt.ts
    ///
    /// Uses: 12-byte IV, returns ciphertext + IV + tag in base64
    @objc func encryptData(_ call: CAPPluginCall) {
        guard let plaintext = call.getString("plaintext"),
              let keyHex = call.getString("keyHex") else {
            call.reject("Missing required parameters: plaintext, keyHex")
            return
        }
        
        // Parse key from hex
        guard let keyData = Data(hexString: keyHex),
              keyData.count == KEY_SIZE_BYTES else {
            call.reject("Invalid key: must be 64-character hex string (256-bit)")
            return
        }
        
        let key = SymmetricKey(data: keyData)
        
        // Generate random nonce (12 bytes)
        var nonceBytes = [UInt8](repeating: 0, count: NONCE_SIZE_BYTES)
        _ = SecRandomCopyBytes(kSecRandomDefault, NONCE_SIZE_BYTES, &nonceBytes)
        
        guard let nonce = try? AES.GCM.Nonce(data: Data(nonceBytes)) else {
            call.reject("Failed to generate nonce")
            return
        }
        
        // Encrypt
        guard let plaintextData = plaintext.data(using: .utf8),
              let sealedBox = try? AES.GCM.seal(plaintextData, using: key, nonce: nonce) else {
            call.reject("Encryption failed")
            return
        }
        
        // Extract components
        // CryptoKit's sealedBox.ciphertext includes only ciphertext (no tag)
        // sealedBox.tag is the authentication tag
        let ciphertext = sealedBox.ciphertext
        let tag = sealedBox.tag
        let iv = Data(nonceBytes)
        
        call.resolve([
            "ciphertext": ciphertext.base64EncodedString(),
            "iv": iv.base64EncodedString(),
            "tag": tag.base64EncodedString(),
            "encoding": "base64",
            "algorithm": "aes-256-gcm"
        ])
    }
    
    // MARK: - Decrypt Data
    
    /// Decrypt data using AES-256-GCM
    /// Mirrors: decryptData() in encrypt.ts
    @objc func decryptData(_ call: CAPPluginCall) {
        guard let payload = call.getObject("payload"),
              let keyHex = call.getString("keyHex") else {
            call.reject("Missing required parameters: payload, keyHex")
            return
        }
        
        guard let ciphertextB64 = payload["ciphertext"] as? String,
              let ivB64 = payload["iv"] as? String,
              let tagB64 = payload["tag"] as? String else {
            call.reject("Invalid payload: missing ciphertext, iv, or tag")
            return
        }
        
        // Parse components from base64
        guard let ciphertext = Data(base64Encoded: ciphertextB64),
              let iv = Data(base64Encoded: ivB64),
              let tag = Data(base64Encoded: tagB64) else {
            call.reject("Invalid base64 encoding in payload")
            return
        }
        
        // Parse key from hex
        guard let keyData = Data(hexString: keyHex),
              keyData.count == KEY_SIZE_BYTES else {
            call.reject("Invalid key")
            return
        }
        
        let key = SymmetricKey(data: keyData)
        
        // Create nonce from IV
        guard let nonce = try? AES.GCM.Nonce(data: iv) else {
            call.reject("Invalid IV")
            return
        }
        
        // Reconstruct sealed box
        guard let sealedBox = try? AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag) else {
            call.reject("Failed to reconstruct sealed box")
            return
        }
        
        // Decrypt
        guard let decryptedData = try? AES.GCM.open(sealedBox, using: key),
              let plaintext = String(data: decryptedData, encoding: .utf8) else {
            call.reject("Decryption failed - invalid key or corrupted data")
            return
        }
        
        call.resolve([
            "plaintext": plaintext
        ])
    }
    
    // MARK: - Store Preference (Stub for Phase 2 SQLCipher)
    
    /// Store encrypted preference in local database
    /// NOTE: Full SQLCipher implementation is Phase 2
    @objc func storePreference(_ call: CAPPluginCall) {
        // For now, store in UserDefaults (encrypted data only)
        // Phase 2 will implement SQLCipher
        guard let userId = call.getString("userId"),
              let domain = call.getString("domain"),
              let fieldName = call.getString("fieldName"),
              let data = call.getObject("data") else {
            call.reject("Missing required parameters")
            return
        }
        
        let key = "vault_\(userId)_\(domain)_\(fieldName)"
        
        // Serialize the encrypted payload
        if let jsonData = try? JSONSerialization.data(withJSONObject: data, options: []) {
            UserDefaults.standard.set(jsonData, forKey: key)
            call.resolve()
        } else {
            call.reject("Failed to serialize data")
        }
    }
    
    // MARK: - Get Preferences (Stub for Phase 2 SQLCipher)
    
    /// Retrieve preferences from local database
    /// NOTE: Full SQLCipher implementation is Phase 2
    @objc func getPreferences(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let domain = call.getString("domain") else {
            call.reject("Missing required parameters")
            return
        }
        
        // Search UserDefaults for matching keys
        let prefix = "vault_\(userId)_\(domain)_"
        var preferences: [[String: Any]] = []
        
        for key in UserDefaults.standard.dictionaryRepresentation().keys {
            if key.hasPrefix(prefix) {
                if let jsonData = UserDefaults.standard.data(forKey: key),
                   let data = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                    let fieldName = String(key.dropFirst(prefix.count))
                    preferences.append([
                        "userId": userId,
                        "domain": domain,
                        "fieldName": fieldName,
                        "data": data,
                        "createdAt": Date().timeIntervalSince1970 * 1000
                    ])
                }
            }
        }
        
        call.resolve([
            "preferences": preferences
        ])
    }
    
    // MARK: - Delete Preferences (Stub for Phase 2 SQLCipher)
    
    /// Delete preferences for a domain
    @objc func deletePreferences(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let domain = call.getString("domain") else {
            call.reject("Missing required parameters")
            return
        }
        
        let prefix = "vault_\(userId)_\(domain)_"
        
        for key in UserDefaults.standard.dictionaryRepresentation().keys {
            if key.hasPrefix(prefix) {
                UserDefaults.standard.removeObject(forKey: key)
            }
        }
        
        call.resolve()
    }
    
    // MARK: - Private Helpers
    
    /// PBKDF2 key derivation using CommonCrypto
    private func pbkdf2Derive(password: String, salt: Data, iterations: Int, keyLength: Int) -> Data? {
        guard let passwordData = password.data(using: .utf8) else {
            return nil
        }
        
        var derivedKey = [UInt8](repeating: 0, count: keyLength)
        
        let status = passwordData.withUnsafeBytes { passwordBytes in
            salt.withUnsafeBytes { saltBytes in
                CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    passwordBytes.baseAddress?.assumingMemoryBound(to: Int8.self),
                    passwordData.count,
                    saltBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                    salt.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                    UInt32(iterations),
                    &derivedKey,
                    keyLength
                )
            }
        }
        
        guard status == kCCSuccess else {
            return nil
        }
        
        return Data(derivedKey)
    }
}

// MARK: - CommonCrypto Import

import CommonCrypto

// MARK: - Data Hex Extension

private extension Data {
    init?(hexString: String) {
        let hex = hexString.replacingOccurrences(of: " ", with: "")
        guard hex.count % 2 == 0 else { return nil }
        
        var data = Data(capacity: hex.count / 2)
        var index = hex.startIndex
        
        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else {
                return nil
            }
            data.append(byte)
            index = nextIndex
        }
        
        self = data
    }
}
