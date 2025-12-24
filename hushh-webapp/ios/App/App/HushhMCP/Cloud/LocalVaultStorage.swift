//
//  LocalVaultStorage.swift
//  App
//
//  Local Vault Storage Implementation
//
//  Implements VaultStorageProtocol using SQLCipherDatabase.
//  All operations are local-first with pending sync status.
//

import Foundation

// MARK: - Local Vault Storage

/// Local on-device vault storage using SQLCipher
public class LocalVaultStorage: VaultStorageProtocol {
    
    private let database = SQLCipherDatabase.shared
    
    public init() {}
    
    public func hasVault(userId: String) async throws -> Bool {
        return database.hasVault(userId: userId)
    }
    
    public func getVault(userId: String) async throws -> VaultKeyInfo {
        guard let data = database.getVaultKey(userId: userId) else {
            throw LocalStorageError.notFound
        }
        return data
    }
    
    public func setupVault(userId: String, data: VaultKeyInfo) async throws {
        database.saveVaultKey(userId: userId, data: data)
    }
}

// MARK: - Errors

public enum LocalStorageError: Error {
    case notFound
    case databaseError(String)
    
    var localizedDescription: String {
        switch self {
        case .notFound:
            return "Record not found in local database"
        case .databaseError(let msg):
            return "Database error: \(msg)"
        }
    }
}
