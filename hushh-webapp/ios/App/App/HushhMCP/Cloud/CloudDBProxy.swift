//
//  CloudDBProxy.swift
//  App
//
//  Cloud Database Proxy Client
//  
//  Minimal HTTP client for Cloud Run database operations.
//  All consent protocol logic runs locally in Swift.
//  This only executes pre-defined SQL operations via secure REST.
//
//  Security:
//  - Requires Firebase ID token
//  - SSL/TLS encrypted (Cloud Run)
//  - No database credentials in app
//

import Foundation

// MARK: - Cloud Run Backend URL

private let CLOUD_DB_URL = "https://consent-protocol-1006304528804.us-central1.run.app/db"

// MARK: - Response Models

struct VaultCheckResponse: Codable {
    let hasVault: Bool
}

struct VaultKeyData: Codable {
    let authMethod: String
    let encryptedVaultKey: String
    let salt: String
    let iv: String
    let recoveryEncryptedVaultKey: String
    let recoverySalt: String
    let recoveryIv: String
}

struct SuccessResponse: Codable {
    let success: Bool
}

// MARK: - CloudDBProxy

/// Cloud Database Proxy Client
///
/// This client communicates with the Cloud Run backend for database operations only.
/// All consent protocol logic (token issuance, encryption, validation) runs locally in Swift.
public class CloudDBProxy {
    
    public static let shared = CloudDBProxy()
    
    private init() {}
    
    // MARK: - Vault Operations
    
    /// Check if a vault exists for the user
    /// - Parameters:
    ///   - userId: Firebase UID
    ///   - authToken: Optional Firebase ID token for authentication
    /// - Returns: Whether the vault exists
    public func hasVault(userId: String, authToken: String?) async throws -> Bool {
        let body = ["userId": userId]
        let response: VaultCheckResponse = try await post(
            endpoint: "/vault/check",
            body: body,
            authToken: authToken
        )
        return response.hasVault
    }
    
    /// Get encrypted vault key data from cloud
    /// - Parameters:
    ///   - userId: Firebase UID
    ///   - authToken: Optional Firebase ID token
    /// - Returns: Encrypted vault key data (decryption happens locally)
    public func getVault(userId: String, authToken: String?) async throws -> VaultKeyData {
        let body = ["userId": userId]
        return try await post(
            endpoint: "/vault/get",
            body: body,
            authToken: authToken
        )
    }
    
    /// Store encrypted vault key data to cloud
    /// - Parameters:
    ///   - userId: Firebase UID
    ///   - data: Vault key data (already encrypted locally with passphrase)
    ///   - authToken: Optional Firebase ID token
    public func setupVault(
        userId: String,
        authMethod: String,
        encryptedVaultKey: String,
        salt: String,
        iv: String,
        recoveryEncryptedVaultKey: String,
        recoverySalt: String,
        recoveryIv: String,
        authToken: String?
    ) async throws {
        let body: [String: Any] = [
            "userId": userId,
            "authMethod": authMethod,
            "encryptedVaultKey": encryptedVaultKey,
            "salt": salt,
            "iv": iv,
            "recoveryEncryptedVaultKey": recoveryEncryptedVaultKey,
            "recoverySalt": recoverySalt,
            "recoveryIv": recoveryIv
        ]
        
        let _: SuccessResponse = try await post(
            endpoint: "/vault/setup",
            body: body,
            authToken: authToken
        )
    }
    
    // MARK: - HTTP Client
    
    private func post<T: Decodable>(
        endpoint: String,
        body: [String: Any],
        authToken: String?
    ) async throws -> T {
        guard let url = URL(string: CLOUD_DB_URL + endpoint) else {
            throw CloudDBError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add Firebase auth token if available
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Serialize body
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        // Execute request
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // Check response status
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudDBError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200, 201:
            // Decode response
            do {
                return try JSONDecoder().decode(T.self, from: data)
            } catch {
                print("[CloudDBProxy] Decode error: \(error)")
                throw CloudDBError.decodingFailed
            }
        case 404:
            throw CloudDBError.notFound
        case 401:
            throw CloudDBError.unauthorized
        default:
            print("[CloudDBProxy] HTTP error: \(httpResponse.statusCode)")
            throw CloudDBError.httpError(httpResponse.statusCode)
        }
    }
}

// MARK: - Errors

public enum CloudDBError: Error {
    case invalidURL
    case invalidResponse
    case decodingFailed
    case notFound
    case unauthorized
    case httpError(Int)
    
    var localizedDescription: String {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .decodingFailed:
            return "Failed to decode response"
        case .notFound:
            return "Resource not found"
        case .unauthorized:
            return "Unauthorized - invalid token"
        case .httpError(let code):
            return "HTTP error: \(code)"
        }
    }
}
