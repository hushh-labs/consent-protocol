//
//  HushhSyncPlugin.swift
//  App
//
//  Capacitor Plugin for Sync Operations
//
//  Exposes SyncService to WebView for user-triggered sync.
//

import Foundation
import Capacitor

@objc(HushhSyncPlugin)
public class HushhSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HushhSyncPlugin"
    public let jsName = "HushhSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "push", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pull", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSyncStatus", returnType: CAPPluginReturnPromise),
    ]
    
    // MARK: - Full Sync
    
    @objc func sync(_ call: CAPPluginCall) {
        if let authToken = call.getString("authToken") {
            SyncService.shared.setAuthToken(authToken)
        }
        
        Task {
            do {
                let result = try await SyncService.shared.sync()
                call.resolve([
                    "success": true,
                    "pushedRecords": result.pushedRecords,
                    "pulledRecords": result.pulledRecords,
                    "conflicts": result.conflicts,
                    "timestamp": result.timestamp.timeIntervalSince1970 * 1000
                ])
            } catch {
                call.reject("Sync failed: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Push Only
    
    @objc func push(_ call: CAPPluginCall) {
        if let authToken = call.getString("authToken") {
            SyncService.shared.setAuthToken(authToken)
        }
        
        Task {
            do {
                let records = try await SyncService.shared.push()
                call.resolve([
                    "success": true,
                    "pushedRecords": records.count
                ])
            } catch {
                call.reject("Push failed: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Pull Only
    
    @objc func pull(_ call: CAPPluginCall) {
        if let authToken = call.getString("authToken") {
            SyncService.shared.setAuthToken(authToken)
        }
        
        Task {
            do {
                let records = try await SyncService.shared.pull()
                call.resolve([
                    "success": true,
                    "pulledRecords": records.count
                ])
            } catch {
                call.reject("Pull failed: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Sync Specific Vault
    
    @objc func syncVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        if let authToken = call.getString("authToken") {
            SyncService.shared.setAuthToken(authToken)
        }
        
        Task {
            do {
                try await SyncService.shared.syncVault(userId: userId)
                call.resolve(["success": true])
            } catch {
                call.reject("Vault sync failed: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Get Sync Status
    
    @objc func getSyncStatus(_ call: CAPPluginCall) {
        let pendingRecords = SQLCipherDatabase.shared.getPendingSyncRecords()
        let lastSync = UserDefaults.standard.integer(forKey: "lastSyncTimestamp")
        
        call.resolve([
            "pendingCount": pendingRecords.count,
            "lastSyncTimestamp": lastSync,
            "hasPendingChanges": pendingRecords.count > 0
        ])
    }
}
