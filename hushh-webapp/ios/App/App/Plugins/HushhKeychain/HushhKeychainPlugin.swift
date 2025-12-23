//
//  HushhKeychainPlugin.swift
//  App
//
//  Hushh Keychain - Secure Storage Plugin
//  iOS Keychain wrapper for vault key and secrets storage
//
//  Features:
//  - Standard Keychain set/get/delete
//  - Biometric (Face ID / Touch ID) protected storage
//  - Configurable accessibility levels
//

import Foundation
import Capacitor
import LocalAuthentication

// MARK: - Plugin

@objc(HushhKeychainPlugin)
public class HushhKeychainPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HushhKeychainPlugin"
    public let jsName = "HushhKeychain"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "delete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isBiometricAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBiometric", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBiometric", returnType: CAPPluginReturnPromise),
    ]
    
    private let serviceName = "com.hushh.pda"
    
    // MARK: - Set
    
    /// Store a value in iOS Keychain
    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"),
              let value = call.getString("value") else {
            call.reject("Missing required parameters: key, value")
            return
        }
        
        let accessGroup = call.getString("accessGroup")
        let accessible = call.getString("accessible") ?? "whenUnlocked"
        
        do {
            try keychainSet(key: key, value: value, accessGroup: accessGroup, accessible: accessible)
            call.resolve()
        } catch {
            call.reject("Failed to store in Keychain: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Get
    
    /// Retrieve a value from iOS Keychain
    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing required parameter: key")
            return
        }
        
        let accessGroup = call.getString("accessGroup")
        
        let value = keychainGet(key: key, accessGroup: accessGroup)
        call.resolve([
            "value": value as Any
        ])
    }
    
    // MARK: - Delete
    
    /// Delete a value from iOS Keychain
    @objc func delete(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing required parameter: key")
            return
        }
        
        let accessGroup = call.getString("accessGroup")
        
        do {
            try keychainDelete(key: key, accessGroup: accessGroup)
            call.resolve()
        } catch {
            call.reject("Failed to delete from Keychain: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Is Biometric Available
    
    /// Check if biometric authentication is available
    @objc func isBiometricAvailable(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        
        let canEvaluate = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        
        if canEvaluate {
            var biometryType: String = "none"
            
            switch context.biometryType {
            case .faceID:
                biometryType = "faceId"
            case .touchID:
                biometryType = "touchId"
            case .opticID:
                biometryType = "opticId"
            @unknown default:
                biometryType = "none"
            }
            
            call.resolve([
                "available": true,
                "type": biometryType
            ])
        } else {
            call.resolve([
                "available": false,
                "type": "none"
            ])
        }
    }
    
    // MARK: - Set Biometric
    
    /// Store a value requiring biometric authentication to retrieve
    @objc func setBiometric(_ call: CAPPluginCall) {
        guard let key = call.getString("key"),
              let value = call.getString("value") else {
            call.reject("Missing required parameters: key, value")
            return
        }
        
        let promptMessage = call.getString("promptMessage") ?? "Authenticate to save securely"
        let accessGroup = call.getString("accessGroup")
        
        // Create access control with biometric protection
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else {
            call.reject("Failed to create access control")
            return
        }
        
        // Create LAContext for biometric prompt
        let context = LAContext()
        context.localizedReason = promptMessage
        
        // Build query
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: value.data(using: .utf8)!,
            kSecAttrAccessControl as String: accessControl,
            kSecUseAuthenticationContext as String: context
        ]
        
        if let group = accessGroup {
            query[kSecAttrAccessGroup as String] = group
        }
        
        // Delete existing item first
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(deleteQuery as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        if status == errSecSuccess {
            call.resolve()
        } else {
            call.reject("Failed to store biometric item: \(status)")
        }
    }
    
    // MARK: - Get Biometric
    
    /// Retrieve a biometric-protected value
    @objc func getBiometric(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("Missing required parameter: key")
            return
        }
        
        let promptMessage = call.getString("promptMessage") ?? "Authenticate to access"
        let accessGroup = call.getString("accessGroup")
        
        // Create LAContext
        let context = LAContext()
        context.localizedReason = promptMessage
        
        // Build query
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context
        ]
        
        if let group = accessGroup {
            query[kSecAttrAccessGroup as String] = group
        }
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess,
           let data = result as? Data,
           let value = String(data: data, encoding: .utf8) {
            call.resolve([
                "value": value
            ])
        } else if status == errSecUserCanceled {
            call.reject("Biometric authentication canceled")
        } else if status == errSecItemNotFound {
            call.resolve([
                "value": NSNull()
            ])
        } else {
            call.reject("Failed to retrieve biometric item: \(status)")
        }
    }
    
    // MARK: - Private Helpers
    
    private func keychainSet(key: String, value: String, accessGroup: String?, accessible: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }
        
        let accessibility = accessibilityFromString(accessible)
        
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: accessibility
        ]
        
        if let group = accessGroup {
            query[kSecAttrAccessGroup as String] = group
        }
        
        // Delete existing item
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(deleteQuery as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }
    
    private func keychainGet(key: String, accessGroup: String?) -> String? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        if let group = accessGroup {
            query[kSecAttrAccessGroup as String] = group
        }
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return value
    }
    
    private func keychainDelete(key: String, accessGroup: String?) throws {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]
        
        if let group = accessGroup {
            query[kSecAttrAccessGroup as String] = group
        }
        
        let status = SecItemDelete(query as CFDictionary)
        
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.deleteFailed(status)
        }
    }
    
    private func accessibilityFromString(_ str: String) -> CFString {
        switch str {
        case "afterFirstUnlock":
            return kSecAttrAccessibleAfterFirstUnlock
        case "always":
            return kSecAttrAccessibleAlways
        case "whenUnlocked":
            fallthrough
        default:
            return kSecAttrAccessibleWhenUnlocked
        }
    }
}

// MARK: - Keychain Error

private enum KeychainError: Error {
    case encodingFailed
    case saveFailed(OSStatus)
    case deleteFailed(OSStatus)
}
