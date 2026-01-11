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
        CAPPluginMethod(name: "getPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetPreferences", returnType: CAPPluginReturnPromise)
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
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[KaiPlugin] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[KaiPlugin] ❌ \(errorMsg)")
                    call.reject(errorMsg)
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
        
        var body: [String: Any] = [
            "user_id": userId,
            "ticker": ticker,
            "consent_token": consentToken,
            "risk_profile": riskProfile,
            "processing_mode": processingMode
        ]
        
        // Include context if provided
        if let context = call.getObject("context") {
            body["context"] = context
        }
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[KaiPlugin] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[KaiPlugin] ❌ \(errorMsg)")
                    call.reject(errorMsg)
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
        guard let userId = call.getString("userId") else {
            print("[KaiPlugin] ❌ Missing required parameters")
            call.reject("Missing required parameters")
            return
        }

        // Canonical payload: preferences array (preferred)
        var preferencesPayload: Any? = nil
        if let preferences = call.getArray("preferences", JSObject.self) {
            preferencesPayload = preferences
        } else if let preferencesEncrypted = call.getString("preferencesEncrypted") {
            // Legacy payload: stringified JSON array
            if let data = preferencesEncrypted.data(using: .utf8) {
                preferencesPayload = try? JSONSerialization.jsonObject(with: data)
            }
        }

        guard preferencesPayload != nil else {
            call.reject("Missing preferences payload")
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
            "preferences": preferencesPayload as Any
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[KaiPlugin] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[KaiPlugin] ❌ \(errorMsg)")
                    call.reject(errorMsg)
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
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[KaiPlugin] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[KaiPlugin] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[KaiPlugin] ❌ \(errorMsg)")
                    call.reject(errorMsg)
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

    @objc func resetPreferences(_ call: CAPPluginCall) {
        print("[KaiPlugin] 🔍 resetPreferences called")
        guard let userId = call.getString("userId"),
              let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            call.reject("Missing required parameters: userId, vaultOwnerToken")
            return
        }

        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/preferences/\(userId)"
        print("[KaiPlugin] 🌐 URL: \(urlStr)")

        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")

        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject("Network error: \(error.localizedDescription)")
                return
            }

            if let httpResponse = response as? HTTPURLResponse {
                if !(200...299).contains(httpResponse.statusCode) {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    call.reject("HTTP Error \(httpResponse.statusCode): \(body)")
                    return
                }
            }

            guard let data = data else {
                call.reject("No data received")
                return
            }

            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    call.resolve(json)
                } else {
                    call.resolve(["success": true])
                }
            } catch {
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
}
