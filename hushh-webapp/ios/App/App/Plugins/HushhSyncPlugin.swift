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

// MARK: - HushhOnboardingPlugin - iOS Implementation
// Handled in the same file to ensure Xcode project tracking.

@objc(HushhOnboardingPlugin)
public class HushhOnboardingPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "HushhOnboardingPlugin"
    public let jsName = "HushhOnboarding"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkOnboardingStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "completeOnboarding", returnType: CAPPluginReturnPromise)
    ]
    
    private let TAG = "HushhOnboarding"
    private var defaultBackendUrl: String {
        return (bridge?.config.getPluginConfig(jsName).getString("backendUrl")) 
            ?? "https://consent-protocol-1006304528804.us-central1.run.app"
    }

    private func getBackendUrl(_ call: CAPPluginCall) -> String {
        if let url = call.getString("backendUrl"), !url.isEmpty {
            return url
        }
        if let url = bridge?.config.getPluginConfig(jsName).getString("backendUrl"), !url.isEmpty {
            return url
        }
        return defaultBackendUrl
    }
    
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()
    
    // MARK: - Plugin Methods
    
    @objc func checkOnboardingStatus(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing required parameter: userId")
            return
        }

        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl(call)
        let encodedUserId = userId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? userId
        let urlStr = "\(backendUrl)/api/onboarding/status?userId=\(encodedUserId)"
        print("🔍 [\(TAG)] checkOnboardingStatus - URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                call.reject("Network error: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
                call.reject("HTTP Error \(httpResponse.statusCode)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let completed = json["completed"] as? Bool ?? false
                    print("🔍 [\(self.TAG)] Onboarding status for \(userId): \(completed)")
                    call.resolve([
                        "completed": completed,
                        "completedAt": json["completedAt"] as? String ?? NSNull()
                    ])
                } else {
                    call.reject("Invalid response format")
                }
            } catch {
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func completeOnboarding(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing required parameter: userId")
            return
        }

        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/onboarding/complete"
        print("🔍 [\(TAG)] completeOnboarding - URL: \(urlStr), userId: \(userId)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = ["userId": userId]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                call.reject("Network error: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
                call.reject("HTTP Error \(httpResponse.statusCode)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    call.resolve(["success": json["success"] as? Bool ?? false])
                } else {
                    call.reject("Invalid response format")
                }
            } catch {
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
}
