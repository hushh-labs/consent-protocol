//
//  SQLCipherDatabase.swift
//  App
//
//  Local Database for On-Device Storage
//
//  Currently uses standard SQLite (iOS built-in).
//  For production, upgrade to SQLCipher for encryption:
//  1. Add GRDB.swift package: https://github.com/groue/GRDB.swift
//  2. Configure with SQLCipher encryption
//
//  Schema mirrors Cloud SQL for seamless sync.
//

import Foundation
import SQLite3

// MARK: - Database Manager

public class SQLCipherDatabase {
    
    public static let shared = SQLCipherDatabase()
    
    private var db: OpaquePointer?
    private let databaseName = "hushh_vault.sqlite"
    
    private init() {
        openDatabase()
        createTables()
    }
    
    deinit {
        sqlite3_close(db)
    }
    
    // MARK: - Database Setup
    
    private func openDatabase() {
        let fileURL = getDatabasePath()
        
        if sqlite3_open(fileURL.path, &db) != SQLITE_OK {
            print("❌ Error opening database: \(String(cString: sqlite3_errmsg(db)))")
            return
        }
        
        // NOTE: SQLCipher encryption disabled for now (standard SQLite)
        // To enable SQLCipher:
        // 1. Add GRDB.swift with SQLCipher support
        // 2. Uncomment: sqlite3_key(db, key, Int32(key.count))
        // let key = getEncryptionKey()
        
        print("✅ SQLite database opened at \(fileURL.path)")
    }
    
    private func getDatabasePath() -> URL {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documentsPath.appendingPathComponent(databaseName)
    }
    
    private func getEncryptionKey() -> String {
        // TODO: Derive from user's vault key stored in Keychain
        // For now, use a static key (replace in production)
        return "hushh_vault_encryption_key_2024"
    }
    
    private func createTables() {
        let createVaultKeysSQL = """
            CREATE TABLE IF NOT EXISTS vault_keys (
                user_id TEXT PRIMARY KEY,
                auth_method TEXT,
                encrypted_vault_key TEXT,
                salt TEXT,
                iv TEXT,
                recovery_encrypted_vault_key TEXT,
                recovery_salt TEXT,
                recovery_iv TEXT,
                created_at INTEGER,
                updated_at INTEGER,
                sync_status TEXT DEFAULT 'pending'
            );
        """
        
        let createSyncLogSQL = """
            CREATE TABLE IF NOT EXISTS sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT,
                record_id TEXT,
                action TEXT,
                timestamp INTEGER,
                synced_at INTEGER
            );
        """
        
        let createVaultDataSQL = """
            CREATE TABLE IF NOT EXISTS vault_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                field_name TEXT NOT NULL,
                ciphertext TEXT,
                iv TEXT,
                tag TEXT,
                algorithm TEXT DEFAULT 'aes-256-gcm',
                created_at INTEGER,
                updated_at INTEGER,
                consent_token_id TEXT,
                sync_status TEXT DEFAULT 'pending',
                UNIQUE(user_id, domain, field_name)
            );
        """
        
        executeSQL(createVaultKeysSQL)
        executeSQL(createSyncLogSQL)
        executeSQL(createVaultDataSQL)
    }
    
    // MARK: - SQL Execution
    
    private func executeSQL(_ sql: String) {
        var statement: OpaquePointer?
        
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            if sqlite3_step(statement) != SQLITE_DONE {
                print("⚠️ SQL execution warning: \(String(cString: sqlite3_errmsg(db)))")
            }
        } else {
            print("❌ SQL prepare error: \(String(cString: sqlite3_errmsg(db)))")
        }
        
        sqlite3_finalize(statement)
    }
    
    // MARK: - Vault Keys Operations
    
    public func hasVault(userId: String) -> Bool {
        let sql = "SELECT 1 FROM vault_keys WHERE user_id = ?"
        var statement: OpaquePointer?
        var exists = false
        
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_text(statement, 1, userId, -1, nil)
            exists = sqlite3_step(statement) == SQLITE_ROW
        }
        
        sqlite3_finalize(statement)
        return exists
    }
    
    public func getVaultKey(userId: String) -> VaultKeyInfo? {
        let sql = """
            SELECT auth_method, encrypted_vault_key, salt, iv,
                   recovery_encrypted_vault_key, recovery_salt, recovery_iv
            FROM vault_keys WHERE user_id = ?
        """
        var statement: OpaquePointer?
        var result: VaultKeyInfo?
        
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_text(statement, 1, userId, -1, nil)
            
            if sqlite3_step(statement) == SQLITE_ROW {
                result = VaultKeyInfo(
                    authMethod: String(cString: sqlite3_column_text(statement, 0)),
                    encryptedVaultKey: String(cString: sqlite3_column_text(statement, 1)),
                    salt: String(cString: sqlite3_column_text(statement, 2)),
                    iv: String(cString: sqlite3_column_text(statement, 3)),
                    recoveryEncryptedVaultKey: String(cString: sqlite3_column_text(statement, 4)),
                    recoverySalt: String(cString: sqlite3_column_text(statement, 5)),
                    recoveryIv: String(cString: sqlite3_column_text(statement, 6))
                )
            }
        }
        
        sqlite3_finalize(statement)
        return result
    }
    
    public func saveVaultKey(userId: String, data: VaultKeyInfo) {
        let sql = """
            INSERT INTO vault_keys (
                user_id, auth_method, encrypted_vault_key, salt, iv,
                recovery_encrypted_vault_key, recovery_salt, recovery_iv,
                created_at, updated_at, sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ON CONFLICT(user_id) DO UPDATE SET
                auth_method = excluded.auth_method,
                encrypted_vault_key = excluded.encrypted_vault_key,
                salt = excluded.salt,
                iv = excluded.iv,
                recovery_encrypted_vault_key = excluded.recovery_encrypted_vault_key,
                recovery_salt = excluded.recovery_salt,
                recovery_iv = excluded.recovery_iv,
                updated_at = excluded.updated_at,
                sync_status = 'pending'
        """
        
        var statement: OpaquePointer?
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_text(statement, 1, userId, -1, nil)
            sqlite3_bind_text(statement, 2, data.authMethod, -1, nil)
            sqlite3_bind_text(statement, 3, data.encryptedVaultKey, -1, nil)
            sqlite3_bind_text(statement, 4, data.salt, -1, nil)
            sqlite3_bind_text(statement, 5, data.iv, -1, nil)
            sqlite3_bind_text(statement, 6, data.recoveryEncryptedVaultKey, -1, nil)
            sqlite3_bind_text(statement, 7, data.recoverySalt, -1, nil)
            sqlite3_bind_text(statement, 8, data.recoveryIv, -1, nil)
            sqlite3_bind_int64(statement, 9, now)
            sqlite3_bind_int64(statement, 10, now)
            
            if sqlite3_step(statement) != SQLITE_DONE {
                print("❌ Error saving vault key: \(String(cString: sqlite3_errmsg(db)))")
            }
            
            // Log for sync
            logSyncAction(table: "vault_keys", recordId: userId, action: "upsert")
        }
        
        sqlite3_finalize(statement)
    }
    
    // MARK: - Sync Support
    
    private func logSyncAction(table: String, recordId: String, action: String) {
        let sql = "INSERT INTO sync_log (table_name, record_id, action, timestamp) VALUES (?, ?, ?, ?)"
        var statement: OpaquePointer?
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_text(statement, 1, table, -1, nil)
            sqlite3_bind_text(statement, 2, recordId, -1, nil)
            sqlite3_bind_text(statement, 3, action, -1, nil)
            sqlite3_bind_int64(statement, 4, now)
            sqlite3_step(statement)
        }
        
        sqlite3_finalize(statement)
    }
    
    public func getPendingSyncRecords() -> [(table: String, recordId: String, action: String, timestamp: Int64)] {
        let sql = """
            SELECT table_name, record_id, action, timestamp 
            FROM sync_log 
            WHERE synced_at IS NULL 
            ORDER BY timestamp ASC
        """
        var statement: OpaquePointer?
        var results: [(table: String, recordId: String, action: String, timestamp: Int64)] = []
        
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            while sqlite3_step(statement) == SQLITE_ROW {
                let table = String(cString: sqlite3_column_text(statement, 0))
                let recordId = String(cString: sqlite3_column_text(statement, 1))
                let action = String(cString: sqlite3_column_text(statement, 2))
                let timestamp = sqlite3_column_int64(statement, 3)
                results.append((table, recordId, action, timestamp))
            }
        }
        
        sqlite3_finalize(statement)
        return results
    }
    
    public func markAsSynced(table: String, recordId: String) {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        
        // Update sync_log
        executeSQL("UPDATE sync_log SET synced_at = \(now) WHERE table_name = '\(table)' AND record_id = '\(recordId)' AND synced_at IS NULL")
        
        // Update record sync_status
        executeSQL("UPDATE \(table) SET sync_status = 'synced' WHERE user_id = '\(recordId)' OR id = '\(recordId)'")
    }
}

// MARK: - SQLCipher Key Function (Future)
// Uncomment when adding SQLCipher/GRDB to the project:
// @_silgen_name("sqlite3_key")
// func sqlite3_key(_ db: OpaquePointer!, _ pKey: UnsafePointer<Int8>!, _ nKey: Int32) -> Int32
