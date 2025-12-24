//
//  HushhConsentPlugin.swift
//  App
//
//  Hushh Consent Protocol - Token Management
//  Port of Python consent-protocol/hushh_mcp/consent/token.py
//
//  Token format: HCT:base64(userId|agentId|scope|issuedAt|expiresAt).hmac_sha256_signature
//

import Foundation
import Capacitor
import CryptoKit

// MARK: - Constants

private let CONSENT_TOKEN_PREFIX = "HCT"
private let TRUST_LINK_PREFIX = "HTL"
private let DEFAULT_CONSENT_TOKEN_EXPIRY_MS: Int64 = 1000 * 60 * 60 * 24 * 7  // 7 days
private let DEFAULT_TRUST_LINK_EXPIRY_MS: Int64 = 1000 * 60 * 60 * 24 * 30    // 30 days

// MARK: - Plugin

@objc(HushhConsentPlugin)
public class HushhConsentPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HushhConsentPlugin"
    public let jsName = "HushhConsent"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "issueToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "validateToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "revokeToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isTokenRevoked", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createTrustLink", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyTrustLink", returnType: CAPPluginReturnPromise),
    ]
    
    // In-memory revocation registry (matches Python implementation)
    private static var revokedTokens: Set<String> = []
    
    // Secret key for HMAC signing - should be set via Keychain at runtime
    private var secretKey: String {
        // Try to get from Keychain, fallback to bundle for development
        if let key = ConsentKeychainHelper.get(key: "hushh_secret_key") {
            return key
        }
        // Fallback for development - in production this should NEVER be used
        return ProcessInfo.processInfo.environment["SECRET_KEY"] ?? "development_secret_key_32_chars!"
    }
    
    // MARK: - Issue Token
    
    /// Issue a new consent token
    /// Mirrors: issue_token() in token.py
    @objc func issueToken(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let agentId = call.getString("agentId"),
              let scope = call.getString("scope") else {
            call.reject("Missing required parameters: userId, agentId, scope")
            return
        }
        
        let expiresInMs = call.getInt("expiresInMs") ?? Int(DEFAULT_CONSENT_TOKEN_EXPIRY_MS)
        
        let issuedAt = Int64(Date().timeIntervalSince1970 * 1000)
        let expiresAt = issuedAt + Int64(expiresInMs)
        
        // Build raw payload: userId|agentId|scope|issuedAt|expiresAt
        let raw = "\(userId)|\(agentId)|\(scope)|\(issuedAt)|\(expiresAt)"
        
        // Sign with HMAC-SHA256
        let signature = sign(input: raw)
        
        // Encode to base64 (URL-safe)
        guard let encodedData = raw.data(using: .utf8) else {
            call.reject("Failed to encode token data")
            return
        }
        let encoded = encodedData.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        
        // Build token: HCT:base64.signature
        let token = "\(CONSENT_TOKEN_PREFIX):\(encoded).\(signature)"
        
        // Generate a short token ID for reference
        let tokenId = String(token.prefix(32))
        
        call.resolve([
            "token": token,
            "tokenId": tokenId,
            "expiresAt": expiresAt
        ])
    }
    
    // MARK: - Validate Token
    
    /// Validate a consent token
    /// Mirrors: validate_token() in token.py
    @objc func validateToken(_ call: CAPPluginCall) {
        guard let tokenStr = call.getString("token") else {
            call.reject("Missing required parameter: token")
            return
        }
        
        let expectedScope = call.getString("expectedScope")
        
        // Check if revoked
        if HushhConsentPlugin.revokedTokens.contains(tokenStr) {
            call.resolve([
                "valid": false,
                "reason": "Token has been revoked"
            ])
            return
        }
        
        do {
            let result = try parseAndValidateToken(tokenStr: tokenStr, expectedScope: expectedScope)
            call.resolve(result)
        } catch let error as TokenError {
            call.resolve([
                "valid": false,
                "reason": error.message
            ])
        } catch {
            call.resolve([
                "valid": false,
                "reason": "Malformed token: \(error.localizedDescription)"
            ])
        }
    }
    
    // MARK: - Revoke Token
    
    /// Revoke a consent token
    /// Mirrors: revoke_token() in token.py
    @objc func revokeToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Missing required parameter: token")
            return
        }
        
        HushhConsentPlugin.revokedTokens.insert(token)
        call.resolve()
    }
    
    // MARK: - Is Token Revoked
    
    /// Check if a token is revoked
    /// Mirrors: is_token_revoked() in token.py
    @objc func isTokenRevoked(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Missing required parameter: token")
            return
        }
        
        let revoked = HushhConsentPlugin.revokedTokens.contains(token)
        call.resolve(["revoked": revoked])
    }
    
    // MARK: - Create Trust Link
    
    /// Create a TrustLink for agent-to-agent delegation
    /// Mirrors: create_trust_link() in link.py
    @objc func createTrustLink(_ call: CAPPluginCall) {
        guard let fromAgent = call.getString("fromAgent"),
              let toAgent = call.getString("toAgent"),
              let scope = call.getString("scope"),
              let signedByUser = call.getString("signedByUser") else {
            call.reject("Missing required parameters")
            return
        }
        
        let expiresInMs = call.getInt("expiresInMs") ?? Int(DEFAULT_TRUST_LINK_EXPIRY_MS)
        
        let createdAt = Int64(Date().timeIntervalSince1970 * 1000)
        let expiresAt = createdAt + Int64(expiresInMs)
        
        // Build raw payload
        let raw = "\(fromAgent)|\(toAgent)|\(scope)|\(createdAt)|\(expiresAt)|\(signedByUser)"
        
        // Sign with HMAC-SHA256
        let signature = sign(input: raw)
        
        call.resolve([
            "fromAgent": fromAgent,
            "toAgent": toAgent,
            "scope": scope,
            "createdAt": createdAt,
            "expiresAt": expiresAt,
            "signedByUser": signedByUser,
            "signature": signature
        ])
    }
    
    // MARK: - Verify Trust Link
    
    /// Verify a TrustLink
    /// Mirrors: verify_trust_link() in link.py
    @objc func verifyTrustLink(_ call: CAPPluginCall) {
        guard let link = call.getObject("link"),
              let fromAgent = link["fromAgent"] as? String,
              let toAgent = link["toAgent"] as? String,
              let scope = link["scope"] as? String,
              let createdAt = link["createdAt"] as? Int64,
              let expiresAt = link["expiresAt"] as? Int64,
              let signedByUser = link["signedByUser"] as? String,
              let signature = link["signature"] as? String else {
            call.reject("Invalid link object")
            return
        }
        
        let requiredScope = call.getString("requiredScope")
        
        // Check expiry
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        if now > expiresAt {
            call.resolve([
                "valid": false,
                "reason": "Trust link expired"
            ])
            return
        }
        
        // Check scope if required
        if let required = requiredScope, scope != required {
            call.resolve([
                "valid": false,
                "reason": "Scope mismatch"
            ])
            return
        }
        
        // Verify signature
        let raw = "\(fromAgent)|\(toAgent)|\(scope)|\(createdAt)|\(expiresAt)|\(signedByUser)"
        let expectedSig = sign(input: raw)
        
        if signature != expectedSig {
            call.resolve([
                "valid": false,
                "reason": "Invalid signature"
            ])
            return
        }
        
        call.resolve([
            "valid": true
        ])
    }
    
    // MARK: - Private Helpers
    
    /// HMAC-SHA256 signing - matches Python _sign() function
    private func sign(input: String) -> String {
        let key = SymmetricKey(data: Data(secretKey.utf8))
        let signature = HMAC<SHA256>.authenticationCode(for: Data(input.utf8), using: key)
        return signature.map { String(format: "%02x", $0) }.joined()
    }
    
    /// Parse and validate token structure
    private func parseAndValidateToken(tokenStr: String, expectedScope: String?) throws -> [String: Any] {
        // Split prefix:signedPart
        let parts = tokenStr.split(separator: ":", maxSplits: 1).map(String.init)
        guard parts.count == 2 else {
            throw TokenError(message: "Invalid token format")
        }
        
        let prefix = parts[0]
        let signedPart = parts[1]
        
        // Validate prefix
        guard prefix == CONSENT_TOKEN_PREFIX else {
            throw TokenError(message: "Invalid token prefix")
        }
        
        // Split encoded.signature
        let signedParts = signedPart.split(separator: ".", maxSplits: 1).map(String.init)
        guard signedParts.count == 2 else {
            throw TokenError(message: "Invalid token format")
        }
        
        let encoded = signedParts[0]
        let signature = signedParts[1]
        
        // Decode base64 (URL-safe to standard)
        var base64 = encoded
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        
        // Add padding if needed
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }
        
        guard let decodedData = Data(base64Encoded: base64),
              let decoded = String(data: decodedData, encoding: .utf8) else {
            throw TokenError(message: "Failed to decode token")
        }
        
        // Parse payload: userId|agentId|scope|issuedAt|expiresAt
        let components = decoded.split(separator: "|").map(String.init)
        guard components.count == 5 else {
            throw TokenError(message: "Invalid token payload")
        }
        
        let userId = components[0]
        let agentId = components[1]
        let scopeStr = components[2]
        guard let issuedAt = Int64(components[3]),
              let expiresAt = Int64(components[4]) else {
            throw TokenError(message: "Invalid timestamp in token")
        }
        
        // Verify signature
        let raw = "\(userId)|\(agentId)|\(scopeStr)|\(issuedAt)|\(expiresAt)"
        let expectedSig = sign(input: raw)
        
        guard signature == expectedSig else {
            throw TokenError(message: "Invalid signature")
        }
        
        // Check scope
        if let expected = expectedScope, scopeStr != expected {
            throw TokenError(message: "Scope mismatch")
        }
        
        // Check expiry
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        if now > expiresAt {
            throw TokenError(message: "Token expired")
        }
        
        return [
            "valid": true,
            "userId": userId,
            "agentId": agentId,
            "scope": scopeStr
        ]
    }
}

// MARK: - TokenError

private struct TokenError: Error {
    let message: String
}

// MARK: - ConsentKeychainHelper (minimal for secret key access - renamed to avoid conflict)

private enum ConsentKeychainHelper {
    static func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.hushh.pda",
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return value
    }
}
