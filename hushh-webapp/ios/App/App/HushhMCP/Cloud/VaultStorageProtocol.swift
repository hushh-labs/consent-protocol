//
//  VaultStorageProtocol.swift
//  App
//
//  Database Abstraction Layer for Vault Storage
//
//  This protocol defines the interface for vault storage operations.
//  Implementations:
//  - CloudVaultStorage: Uses CloudDBProxy for cloud storage (current)
//  - LocalVaultStorage: Will use SQLCipher for on-device storage (future)
//
//  This abstraction ensures minimal code changes when switching between
//  cloud and local storage modes.
//

import Foundation

// MARK: - Vault Data Model

/// Encrypted vault key data
public struct VaultKeyInfo {
    let authMethod: String
    let encryptedVaultKey: String
    let salt: String
    let iv: String
    let recoveryEncryptedVaultKey: String
    let recoverySalt: String
    let recoveryIv: String
}

// MARK: - Vault Storage Protocol

/// Protocol for vault storage operations
/// Implement this for both cloud and local storage backends
public protocol VaultStorageProtocol {
    /// Check if a vault exists for the user
    func hasVault(userId: String) async throws -> Bool
    
    /// Get encrypted vault key data
    func getVault(userId: String) async throws -> VaultKeyInfo
    
    /// Store encrypted vault key data
    func setupVault(userId: String, data: VaultKeyInfo) async throws
}

// MARK: - Cloud Implementation

/// Cloud-based vault storage using CloudDBProxy
public class CloudVaultStorage: VaultStorageProtocol {
    
    private let proxy = CloudDBProxy.shared
    private var authToken: String?
    
    public init(authToken: String? = nil) {
        self.authToken = authToken
    }
    
    public func setAuthToken(_ token: String?) {
        self.authToken = token
    }
    
    public func hasVault(userId: String) async throws -> Bool {
        return try await proxy.hasVault(userId: userId, authToken: authToken)
    }
    
    public func getVault(userId: String) async throws -> VaultKeyInfo {
        let data = try await proxy.getVault(userId: userId, authToken: authToken)
        return VaultKeyInfo(
            authMethod: data.authMethod,
            encryptedVaultKey: data.encryptedVaultKey,
            salt: data.salt,
            iv: data.iv,
            recoveryEncryptedVaultKey: data.recoveryEncryptedVaultKey,
            recoverySalt: data.recoverySalt,
            recoveryIv: data.recoveryIv
        )
    }
    
    public func setupVault(userId: String, data: VaultKeyInfo) async throws {
        try await proxy.setupVault(
            userId: userId,
            authMethod: data.authMethod,
            encryptedVaultKey: data.encryptedVaultKey,
            salt: data.salt,
            iv: data.iv,
            recoveryEncryptedVaultKey: data.recoveryEncryptedVaultKey,
            recoverySalt: data.recoverySalt,
            recoveryIv: data.recoveryIv,
            authToken: authToken
        )
    }
}

// NOTE: LocalVaultStorage is now implemented in LocalVaultStorage.swift

// MARK: - Storage Manager

/// Manages which storage backend to use based on settings
/// NOTE: Temporarily defaulting to CLOUD while debugging local storage
public class VaultStorageManager {
    
    public static let shared = VaultStorageManager()
    
    private var storage: VaultStorageProtocol
    private var authToken: String?
    
    private init() {
        // TEMPORARY: Default to cloud storage while debugging local SQLite
        // TODO: Switch back to LocalVaultStorage once debugged
        self.storage = CloudVaultStorage()
        print("☁️ VaultStorageManager initialized with CLOUD storage (temporary)")
    }
    
    /// Get the current storage backend
    public func getStorage() -> VaultStorageProtocol {
        return storage
    }
    
    /// Switch to cloud storage (for cloud-only mode)
    public func useCloud(authToken: String?) {
        self.authToken = authToken
        let cloud = CloudVaultStorage(authToken: authToken)
        self.storage = cloud
        print("☁️ Switched to cloud storage")
    }
    
    /// Switch to local storage (default)
    public func useLocal() {
        self.storage = LocalVaultStorage()
        print("📱 Switched to local storage")
    }
    
    /// Update auth token for cloud storage or sync
    public func setAuthToken(_ token: String?) {
        self.authToken = token
        if let cloud = storage as? CloudVaultStorage {
            cloud.setAuthToken(token)
        }
        SyncService.shared.setAuthToken(token)
    }
    
    /// Get auth token for sync operations
    public func getAuthToken() -> String? {
        return authToken
    }
}

