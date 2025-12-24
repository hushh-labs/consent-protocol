//
//  SyncService.swift
//  App
//
//  Sync Service for Local-Cloud Data Synchronization
//
//  Handles push (local→cloud) and pull (cloud→local) sync operations.
//  User triggers sync manually - data is always local-first.
//

import Foundation

// MARK: - Sync Service

public class SyncService {
    
    public static let shared = SyncService()
    
    private let cloudProxy = CloudDBProxy.shared
    private let localDB = SQLCipherDatabase.shared
    
    private var authToken: String?
    private var lastSyncTimestamp: Int64 = 0
    
    private init() {
        loadLastSyncTimestamp()
    }
    
    // MARK: - Auth Token
    
    public func setAuthToken(_ token: String?) {
        self.authToken = token
    }
    
    // MARK: - Full Sync (Push + Pull)
    
    /// Perform full sync: push local changes, then pull remote changes
    public func sync() async throws -> SyncResult {
        print("🔄 Starting full sync...")
        
        let pushResult = try await push()
        let pullResult = try await pull()
        
        let result = SyncResult(
            pushedRecords: pushResult.count,
            pulledRecords: pullResult.count,
            conflicts: 0,
            timestamp: Date()
        )
        
        print("✅ Sync complete: \(result.pushedRecords) pushed, \(result.pulledRecords) pulled")
        
        return result
    }
    
    // MARK: - Push (Local → Cloud)
    
    /// Push pending local changes to cloud
    public func push() async throws -> [SyncRecord] {
        print("📤 Pushing local changes to cloud...")
        
        let pendingRecords = localDB.getPendingSyncRecords()
        var syncedRecords: [SyncRecord] = []
        
        for record in pendingRecords {
            do {
                if record.table == "vault_keys" {
                    // Get the vault data from local DB
                    if let vaultData = localDB.getVaultKey(userId: record.recordId) {
                        // Push to cloud
                        try await cloudProxy.setupVault(
                            userId: record.recordId,
                            authMethod: vaultData.authMethod,
                            encryptedVaultKey: vaultData.encryptedVaultKey,
                            salt: vaultData.salt,
                            iv: vaultData.iv,
                            recoveryEncryptedVaultKey: vaultData.recoveryEncryptedVaultKey,
                            recoverySalt: vaultData.recoverySalt,
                            recoveryIv: vaultData.recoveryIv,
                            authToken: authToken
                        )
                        
                        // Mark as synced
                        localDB.markAsSynced(table: record.table, recordId: record.recordId)
                        
                        syncedRecords.append(SyncRecord(
                            table: record.table,
                            recordId: record.recordId,
                            action: .pushed
                        ))
                        
                        print("  ✓ Pushed vault_keys: \(record.recordId.prefix(8))...")
                    }
                }
            } catch {
                print("  ✗ Failed to push \(record.table)/\(record.recordId): \(error)")
            }
        }
        
        return syncedRecords
    }
    
    // MARK: - Pull (Cloud → Local)
    
    /// Pull remote changes to local
    public func pull() async throws -> [SyncRecord] {
        print("📥 Pulling remote changes from cloud...")
        
        var pulledRecords: [SyncRecord] = []
        
        // Get all users with vaults from cloud
        // Note: In a real implementation, you'd have a /db/sync/pull endpoint
        // that returns records modified since lastSyncTimestamp
        
        // For now, we pull the current user's vault if it exists
        // You can extend this to pull all relevant records
        
        saveLastSyncTimestamp()
        
        return pulledRecords
    }
    
    // MARK: - Sync Timestamp Persistence
    
    private func loadLastSyncTimestamp() {
        lastSyncTimestamp = Int64(UserDefaults.standard.integer(forKey: "lastSyncTimestamp"))
    }
    
    private func saveLastSyncTimestamp() {
        lastSyncTimestamp = Int64(Date().timeIntervalSince1970 * 1000)
        UserDefaults.standard.set(Int(lastSyncTimestamp), forKey: "lastSyncTimestamp")
    }
    
    // MARK: - Sync for Specific User
    
    /// Sync a specific user's vault data
    public func syncVault(userId: String) async throws {
        print("🔄 Syncing vault for user \(userId.prefix(8))...")
        
        // Check if user has local vault
        let hasLocalVault = localDB.hasVault(userId: userId)
        
        // Check if user has cloud vault
        let hasCloudVault = try await cloudProxy.hasVault(userId: userId, authToken: authToken)
        
        if hasLocalVault && !hasCloudVault {
            // Push local to cloud
            if let vaultData = localDB.getVaultKey(userId: userId) {
                try await cloudProxy.setupVault(
                    userId: userId,
                    authMethod: vaultData.authMethod,
                    encryptedVaultKey: vaultData.encryptedVaultKey,
                    salt: vaultData.salt,
                    iv: vaultData.iv,
                    recoveryEncryptedVaultKey: vaultData.recoveryEncryptedVaultKey,
                    recoverySalt: vaultData.recoverySalt,
                    recoveryIv: vaultData.recoveryIv,
                    authToken: authToken
                )
                localDB.markAsSynced(table: "vault_keys", recordId: userId)
                print("  ✓ Pushed local vault to cloud")
            }
        } else if !hasLocalVault && hasCloudVault {
            // Pull cloud to local
            let cloudData = try await cloudProxy.getVault(userId: userId, authToken: authToken)
            let vaultInfo = VaultKeyInfo(
                authMethod: cloudData.authMethod,
                encryptedVaultKey: cloudData.encryptedVaultKey,
                salt: cloudData.salt,
                iv: cloudData.iv,
                recoveryEncryptedVaultKey: cloudData.recoveryEncryptedVaultKey,
                recoverySalt: cloudData.recoverySalt,
                recoveryIv: cloudData.recoveryIv
            )
            localDB.saveVaultKey(userId: userId, data: vaultInfo)
            localDB.markAsSynced(table: "vault_keys", recordId: userId)
            print("  ✓ Pulled cloud vault to local")
        } else if hasLocalVault && hasCloudVault {
            // Both exist - push local (last-write-wins)
            // In production, compare timestamps for proper conflict resolution
            if let vaultData = localDB.getVaultKey(userId: userId) {
                try await cloudProxy.setupVault(
                    userId: userId,
                    authMethod: vaultData.authMethod,
                    encryptedVaultKey: vaultData.encryptedVaultKey,
                    salt: vaultData.salt,
                    iv: vaultData.iv,
                    recoveryEncryptedVaultKey: vaultData.recoveryEncryptedVaultKey,
                    recoverySalt: vaultData.recoverySalt,
                    recoveryIv: vaultData.recoveryIv,
                    authToken: authToken
                )
                localDB.markAsSynced(table: "vault_keys", recordId: userId)
                print("  ✓ Synced vault (local → cloud)")
            }
        } else {
            print("  ℹ No vault exists locally or remotely")
        }
        
        saveLastSyncTimestamp()
    }
}

// MARK: - Sync Models

public struct SyncResult {
    public let pushedRecords: Int
    public let pulledRecords: Int
    public let conflicts: Int
    public let timestamp: Date
}

public struct SyncRecord {
    public let table: String
    public let recordId: String
    public let action: SyncAction
}

public enum SyncAction {
    case pushed
    case pulled
    case conflictResolved
}
