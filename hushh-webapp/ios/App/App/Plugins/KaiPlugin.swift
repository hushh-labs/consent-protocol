import Capacitor
import Foundation

/**
 * Kai Plugin - iOS Implementation
 * 
 * Native plugin for Agent Kai stock analysis.
 * Makes HTTP calls to backend from native code.
 */

@objc(KaiPlugin)
public class KaiPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // URLSession with 30s timeout
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "KaiPlugin"
    public let jsName = "Kai"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "grantConsent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storePreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPreferences", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Configuration
    
    private var defaultBackendUrl: String {
        let configUrl = bridge?.config.getPluginConfig("Kai").getString("backendUrl")
        print("[KaiPlugin] 🥖 config.getPluginConfig(\"Kai\").getString(\"backendUrl\") check: \(configUrl ?? "nil")")
        return configUrl ?? "https://consent-protocol-1006304528804.us-central1.run.app"
    }

    private func getBackendUrl(_ call: CAPPluginCall) -> String {
        // 1. Check call parameters
        if let url = call.getString("backendUrl") {
            print("[KaiPlugin] 🌐 Using backendUrl from call params: \(url)")
            return url
        }

        // 2. Check capacitor config (Plugin specific: plugins.Kai.backendUrl)
        if let url = bridge?.config.getPluginConfig("Kai").getString("backendUrl") {
            print("[KaiPlugin] 🌐 Using backendUrl from Kai plugin config: \(url)")
            return url
        }

        // 3. Check for environment variable (as a fallback, though unlikely to be accessible here)
        if let envUrl = ProcessInfo.processInfo.environment["NEXT_PUBLIC_BACKEND_URL"] {
             print("[KaiPlugin] 🌐 Using backendUrl from Environment: \(envUrl)")
             return envUrl
        }

        // 4. Default
        let url = defaultBackendUrl
        print("[KaiPlugin] 🌐 Using final fallback backendUrl: \(url)")
        return url
    }
    
    // MARK: - Plugin Methods
    
    @objc func grantConsent(_ call: CAPPluginCall) {
        print("[KaiPlugin] 🔍 grantConsent called")
        guard let userId = call.getString("userId"),
              let scopes = call.getArray("scopes", String.self) else {
            print("[KaiPlugin] ❌ Missing required parameters: userId, scopes")
            call.reject("Missing required parameters: userId, scopes")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/consent/grant"
        print("[KaiPlugin] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "user_id": userId,
            "scopes": scopes
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                print("[KaiPlugin] ❌ Network error: \(error.localizedDescription)")
                call.reject("Network error: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    print("[KaiPlugin] ❌ HTTP Error \(httpResponse.statusCode): \(body)")
                    call.reject("HTTP Error \(httpResponse.statusCode): \(body)")
                    return
                }
            }
            
            guard let data = data else {
                print("[KaiPlugin] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[KaiPlugin] ✅ grantConsent success: \(json.keys)")
                    call.resolve(json)
                } else if let array = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                    print("[KaiPlugin] ✅ grantConsent success (Array)")
                    call.resolve(["data": array])
                } else {
                    print("[KaiPlugin] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[KaiPlugin] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func analyze(_ call: CAPPluginCall) {
        print("[KaiPlugin] 🔍 analyze called")
        guard let userId = call.getString("userId"),
              let ticker = call.getString("ticker"),
              let consentToken = call.getString("consentToken"),
              let riskProfile = call.getString("riskProfile"),
              let processingMode = call.getString("processingMode") else {
            print("[KaiPlugin] ❌ Missing required parameters")
            call.reject("Missing required parameters")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/analyze"
        print("[KaiPlugin] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "user_id": userId,
            "ticker": ticker,
            "consent_token": consentToken,
            "risk_profile": riskProfile,
            "processing_mode": processingMode
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                print("[KaiPlugin] ❌ Network error: \(error.localizedDescription)")
                call.reject("Network error: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    print("[KaiPlugin] ❌ HTTP Error \(httpResponse.statusCode): \(body)")
                    call.reject("HTTP Error \(httpResponse.statusCode): \(body)")
                    return
                }
            }
            
            guard let data = data else {
                print("[KaiPlugin] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[KaiPlugin] ✅ analyze success")
                    // Aligned with Android: return flat JSON directly
                    call.resolve(json)
                } else {
                    print("[KaiPlugin] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[KaiPlugin] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func storePreferences(_ call: CAPPluginCall) {
        print("[KaiPlugin] 🔍 storePreferences called")
        guard let userId = call.getString("userId"),
              let preferencesEncrypted = call.getString("preferencesEncrypted") else {
            print("[KaiPlugin] ❌ Missing required parameters")
            call.reject("Missing required parameters")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/preferences/store"
        print("[KaiPlugin] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "user_id": userId,
            "preferences_encrypted": preferencesEncrypted
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                print("[KaiPlugin] ❌ Network error: \(error.localizedDescription)")
                call.reject("Network error: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    print("[KaiPlugin] ❌ HTTP Error \(httpResponse.statusCode): \(body)")
                    call.reject("HTTP Error \(httpResponse.statusCode): \(body)")
                    return
                }
            }
            
            guard let data = data else {
                print("[KaiPlugin] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[KaiPlugin] ✅ storePreferences success")
                    call.resolve(json)
                } else {
                    print("[KaiPlugin] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[KaiPlugin] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func getPreferences(_ call: CAPPluginCall) {
        print("[KaiPlugin] 🔍 getPreferences called")
        guard let userId = call.getString("userId") else {
            print("[KaiPlugin] ❌ Missing required parameter: userId")
            call.reject("Missing required parameter: userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/preferences/\(userId)"
        print("[KaiPlugin] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                print("[KaiPlugin] ❌ Network error: \(error.localizedDescription)")
                call.reject("Network error: \(error.localizedDescription)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    print("[KaiPlugin] ❌ HTTP Error \(httpResponse.statusCode): \(body)")
                    call.reject("HTTP Error \(httpResponse.statusCode): \(body)")
                    return
                }
            }
            
            guard let data = data else {
                print("[KaiPlugin] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[KaiPlugin] ✅ getPreferences success")
                    call.resolve(json)
                } else {
                    print("[KaiPlugin] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[KaiPlugin] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
}
