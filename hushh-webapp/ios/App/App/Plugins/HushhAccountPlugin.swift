// hushh-webapp/ios/App/App/Plugins/HushhAccountPlugin.swift
import Capacitor

/**
 * HushhAccountPlugin
 * Handles account-level operations like deletion.
 */
@objc(HushhAccountPlugin)
public class HushhAccountPlugin: CAPPlugin, CAPBridgedPlugin {
    
    public let identifier = "HushhAccountPlugin"
    public let jsName = "HushhAccount"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "deleteAccount", returnType: CAPPluginReturnPromise)
    ]
    
    private let defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"
    
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 45 // Longer timeout for deletion
        return URLSession(configuration: config)
    }()
    
    @objc func deleteAccount(_ call: CAPPluginCall) {
        // Get auth token passed from JS layer
        guard let authToken = call.getString("authToken") else {
             call.reject("Missing required parameter: authToken")
             return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let url = URL(string: "\(backendUrl)/api/account/delete") else {
            call.reject("Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        
        print("🚨 [HushhAccountPlugin] Requesting account deletion...")
        
        let task = urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject("Network error: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                if (200...299).contains(httpResponse.statusCode) {
                    call.resolve(["success": true])
                } else {
                    // Try to parse error message
                    if let data = data, 
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], 
                       let detail = json["detail"] as? String {
                        call.reject(detail)
                    } else {
                         call.reject("Server returned \(httpResponse.statusCode)")
                    }
                }
            } else {
                call.reject("Invalid response")
            }
        }
        task.resume()
    }
}
