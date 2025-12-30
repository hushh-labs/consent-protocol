import Capacitor

/**
 * HushhSyncPlugin - Cloud Synchronization (Capacitor 8)
 * Port of Android HushhSyncPlugin.kt
 */
@objc(HushhSyncPlugin)
public class HushhSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "HushhSyncPlugin"
    public let jsName = "HushhSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "push", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pull", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSyncStatus", returnType: CAPPluginReturnPromise)
    ]
    
    private let TAG = "HushhSync"
    private let defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"
    
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()
    
    // MARK: - Sync
    @objc func sync(_ call: CAPPluginCall) {
        let authToken = call.getString("authToken")
        
        // Placeholder: push + pull
        let pushResult = performPush(authToken: authToken)
        let pullResult = performPull(authToken: authToken)
        
        call.resolve([
            "success": true,
            "pushedRecords": pushResult,
            "pulledRecords": pullResult,
            "conflicts": 0,
            "timestamp": Int64(Date().timeIntervalSince1970 * 1000)
        ])
    }
    
    // MARK: - Push
    @objc func push(_ call: CAPPluginCall) {
        let authToken = call.getString("authToken")
        let pushedRecords = performPush(authToken: authToken)
        
        call.resolve([
            "success": true,
            "pushedRecords": pushedRecords
        ])
    }
    
    // MARK: - Pull
    @objc func pull(_ call: CAPPluginCall) {
        let authToken = call.getString("authToken")
        let pulledRecords = performPull(authToken: authToken)
        
        call.resolve([
            "success": true,
            "pulledRecords": pulledRecords
        ])
    }
    
    // MARK: - Sync Vault
    @objc func syncVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing required parameter: userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let url = URL(string: "\(backendUrl)/api/sync/vault") else {
            call.reject("Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: ["userId": userId])
        } catch {
            call.reject("Failed to encode body")
            return
        }
        
        urlSession.dataTask(with: request) { _, response, error in
            if let httpResponse = response as? HTTPURLResponse {
                call.resolve(["success": (200...299).contains(httpResponse.statusCode)])
            } else {
                call.resolve(["success": false])
            }
        }.resume()
    }
    
    // MARK: - Get Sync Status
    @objc func getSyncStatus(_ call: CAPPluginCall) {
        // Placeholder - no local SQLCipher yet
        call.resolve([
            "pendingCount": 0,
            "lastSyncTimestamp": 0,
            "hasPendingChanges": false
        ])
    }
    
    // MARK: - Private Helpers
    private func performPush(authToken: String?) -> Int {
        print("🔄 [\(TAG)] Push completed")
        return 0
    }
    
    private func performPull(authToken: String?) -> Int {
        print("🔄 [\(TAG)] Pull completed")
        return 0
    }
}
