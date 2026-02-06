import UIKit
import Capacitor

/**
 * Kai Plugin - iOS Implementation
 * 
 * Native plugin for Agent Kai stock analysis.
 * Makes HTTP calls to backend from native code.
 * 
 * Authentication:
 * - All consent-gated operations use VAULT_OWNER token
 * - Token proves both identity (user_id) and consent (vault unlocked)
 * - Firebase is only used for bootstrap (issuing VAULT_OWNER token)
 * 
 * Aligned with Android KaiPlugin implementation for consistent behavior.
 */

@objc(KaiPlugin)
public class KaiPlugin: CAPPlugin, CAPBridgedPlugin, URLSessionDataDelegate {
    
    private let TAG = "KaiPlugin"
    
    // MARK: - CAPBridgedPlugin Protocol (MUST be declared before any other properties)
    public let identifier = "KaiPlugin"
    public let jsName = "Kai"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "grantConsent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storePreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "importPortfolio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "analyzePortfolioLosers", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "streamPortfolioImport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "streamPortfolioAnalyzeLosers", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "chat", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getInitialChatState", returnType: CAPPluginReturnPromise)
    ]
    
    // URLSession with timeouts matching Android (Kai analysis can take 2+ minutes)
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 150  // Match Android readTimeout
        config.timeoutIntervalForResource = 170 // Match Android callTimeout
        return URLSession(configuration: config)
    }()
    
    // Streaming: session with delegate to receive incremental SSE data (WKWebView buffers fetch otherwise)
    private var streamSession: URLSession?
    private var streamCall: CAPPluginCall?
    private var streamBuffer = ""
    private var streamTask: URLSessionDataTask?
    
    // MARK: - Configuration
    
    private var defaultBackendUrl: String {
        return (bridge?.config.getPluginConfig(jsName).getString("backendUrl")) 
            ?? "https://consent-protocol-1006304528804.us-central1.run.app"
    }

    private func getBackendUrl(_ call: CAPPluginCall) -> String {
        // 1. Check call parameters (allows per-call override for testing)
        if let url = call.getString("backendUrl"), !url.isEmpty {
            print("[\(TAG)] 🌐 Using backendUrl from call params: \(url)")
            return url
        }

        // 2. Check capacitor config (Plugin specific: plugins.Kai.backendUrl)
        if let url = bridge?.config.getPluginConfig(jsName).getString("backendUrl"), !url.isEmpty {
            print("[\(TAG)] 🌐 Using backendUrl from plugin config: \(url)")
            return url
        }

        // 3. Check for environment variable (fallback for CI/local dev)
        if let envUrl = ProcessInfo.processInfo.environment["NEXT_PUBLIC_BACKEND_URL"], !envUrl.isEmpty {
            print("[\(TAG)] 🌐 Using backendUrl from Environment: \(envUrl)")
            return envUrl
        }

        // 4. Default to production
        let url = defaultBackendUrl
        print("[\(TAG)] 🌐 Using default backendUrl: \(url)")
        return url
    }
    
    // MARK: - Plugin Methods
    
    @objc func grantConsent(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 grantConsent called")
        guard let userId = call.getString("userId"),
              let scopes = call.getArray("scopes", String.self) else {
            print("[\(TAG)] ❌ Missing required parameters: userId, scopes")
            call.reject("Missing required parameters: userId, scopes")
            return
        }

        // Bootstrap route: backend requires Firebase ID token (NOT VAULT_OWNER).
        guard let authToken = call.getString("authToken"), !authToken.isEmpty else {
            call.reject("Missing authToken (Firebase ID token) for grantConsent")
            return
        }
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/consent/grant"
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        
        let body: [String: Any] = [
            "user_id": userId,
            "scopes": scopes
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }
            
            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    // Normalize response shape to match TS contract:
                    // Promise<{ token: string; expires_at: string }>
                    if let tokens = json["tokens"] as? [String: Any] {
                        let token =
                            (tokens["agent.kai.analyze"] as? String) ??
                            (tokens.values.first as? String) ??
                            ""
                        let expiresAt = (json["expires_at"] as? String) ?? ""
                        call.resolve(["token": token, "expires_at": expiresAt])
                    } else if let token = json["token"] as? String, let expiresAt = json["expires_at"] as? String {
                        call.resolve(["token": token, "expires_at": expiresAt])
                    } else {
                        print("[\(self.TAG)] ✅ grantConsent success (unrecognized shape): \(json.keys)")
                        call.resolve(json)
                    }
                } else if let array = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                    print("[\(self.TAG)] ✅ grantConsent success (Array)")
                    call.resolve(["data": array])
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func analyze(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 analyze called")
        guard let userId = call.getString("userId"),
              let ticker = call.getString("ticker"),
              let consentToken = call.getString("consentToken"),
              let riskProfile = call.getString("riskProfile"),
              let processingMode = call.getString("processingMode") else {
            print("[\(TAG)] ❌ Missing required parameters")
            call.reject("Missing required parameters")
            return
        }
        
        // Consent-gated: requires VAULT_OWNER token
        guard let vaultOwnerToken = call.getString("vaultOwnerToken"), !vaultOwnerToken.isEmpty else {
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/analyze"
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        
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
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }
            
            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ analyze success")
                    // Aligned with Android: return flat JSON directly
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func storePreferences(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 storePreferences called")
        guard let userId = call.getString("userId") else {
            print("[\(TAG)] ❌ Missing required parameters")
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
        
        // Consent-gated: requires VAULT_OWNER token
        guard let vaultOwnerToken = call.getString("vaultOwnerToken"), !vaultOwnerToken.isEmpty else {
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/preferences/store"
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        
        let body: [String: Any] = [
            "user_id": userId,
            "preferences": preferencesPayload as Any
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }
            
            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ storePreferences success")
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func getPreferences(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 getPreferences called")
        guard let userId = call.getString("userId") else {
            print("[\(TAG)] ❌ Missing required parameter: userId")
            call.reject("Missing required parameter: userId")
            return
        }
        
        // Consent-gated: requires VAULT_OWNER token
        guard let vaultOwnerToken = call.getString("vaultOwnerToken"), !vaultOwnerToken.isEmpty else {
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/preferences/\(userId)"
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }
            
            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ getPreferences success")
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }

    @objc func resetPreferences(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 resetPreferences called")
        guard let userId = call.getString("userId"),
              let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            call.reject("Missing required parameters: userId, vaultOwnerToken")
            return
        }

        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/preferences/\(userId)"
        print("[\(TAG)] 🌐 URL: \(urlStr)")

        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")

        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("[\(self.TAG)] ❌ Network error: \(error.localizedDescription)")
                call.reject("Network error: \(error.localizedDescription)")
                return
            }

            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    print("[\(self.TAG)] ❌ HTTP Error \(httpResponse.statusCode): \(body)")
                    call.reject("HTTP Error \(httpResponse.statusCode): \(body)")
                    return
                }
            }

            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }

            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ resetPreferences success")
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ✅ resetPreferences success (no body)")
                    call.resolve(["success": true])
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Portfolio Import
    
    @objc func importPortfolio(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 importPortfolio called")
        
        guard let userId = call.getString("userId"),
              let fileName = call.getString("fileName"),
              let mimeType = call.getString("mimeType"),
              let vaultOwnerToken = call.getString("vaultOwnerToken"),
              let fileBase64 = call.getString("fileBase64") else {
            print("[\(TAG)] ❌ Missing required parameters: userId, fileName, mimeType, vaultOwnerToken, fileBase64")
            call.reject("Missing required parameters: userId, fileName, mimeType, vaultOwnerToken, fileBase64")
            return
        }
        
        // Decode base64 file content
        guard let fileData = Data(base64Encoded: fileBase64) else {
            print("[\(TAG)] ❌ Invalid base64 file content")
            call.reject("Invalid base64 file content")
            return
        }
        
        // Check file size (max 10MB)
        if fileData.count > 10 * 1024 * 1024 {
            print("[\(TAG)] ❌ File too large")
            call.reject("File too large. Maximum size is 10MB.")
            return
        }
        
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/portfolio/import"
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        print("[\(TAG)] 📁 File: \(fileName) (\(fileData.count) bytes)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        // Create multipart form data request
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        // Use VAULT_OWNER token for consent-gated access
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        
        // Build multipart body
        var body = Data()
        
        // Add user_id field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"user_id\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(userId)\r\n".data(using: .utf8)!)
        
        // Add file field
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)
        
        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 500 ? String(bodyStr.prefix(500)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }
            
            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ importPortfolio success: holdings=\(json["holdings_count"] ?? "?")")
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }

    // MARK: - Losers Analysis

    @objc func analyzePortfolioLosers(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 analyzePortfolioLosers called")

        guard let userId = call.getString("userId"),
              let losers = call.getArray("losers", JSObject.self),
              let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            print("[\(TAG)] ❌ Missing required parameters: userId, losers, vaultOwnerToken")
            call.reject("Missing required parameters: userId, losers, vaultOwnerToken")
            return
        }

        let thresholdPct = call.getDouble("thresholdPct") ?? -5.0
        let maxPositions = call.getInt("maxPositions") ?? 10

        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/portfolio/analyze-losers"
        print("[\(TAG)] 🌐 URL: \(urlStr)")

        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "user_id": userId,
            "losers": losers,
            "threshold_pct": thresholdPct,
            "max_positions": maxPositions
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }

            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 500 ? String(bodyStr.prefix(500)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }

            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }

            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ analyzePortfolioLosers success")
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Portfolio streaming (real-time SSE on iOS; avoids WKWebView fetch buffering)
    
    private static let kPortfolioStreamEvent = "portfolioStreamEvent"
    
    private func makeStreamSession() -> URLSession {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 150
        config.timeoutIntervalForResource = 300
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }
    
    private func emitSSEEvent(_ data: [String: Any]) {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners(KaiPlugin.kPortfolioStreamEvent, data: data)
        }
    }
    
    private func parseSSELinesAndEmit() {
        let lines = streamBuffer.split(separator: "\n", omittingEmptySubsequences: false)
        guard !lines.isEmpty else { return }
        let fullLines = lines.dropLast(1).map { String($0) }
        let last = String(lines.last ?? "")
        streamBuffer = last
        
        for line in fullLines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.hasPrefix("data: ") else { continue }
            let jsonStr = String(trimmed.dropFirst(6))
            guard let jsonData = jsonStr.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else { continue }
            emitSSEEvent(obj)
        }
    }
    
    public func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        if let str = String(data: data, encoding: .utf8) {
            streamBuffer += str
            parseSSELinesAndEmit()
        }
    }
    
    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let call = streamCall
        streamCall = nil
        streamTask = nil
        
        // Process any remaining buffer before clearing
        if !streamBuffer.isEmpty {
            parseSSELinesAndEmit()
        }
        streamBuffer = ""
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let error = error {
                call?.reject("Stream error: \(error.localizedDescription)")
                return
            }
            if let httpResponse = task.response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
                call?.reject("HTTP \(httpResponse.statusCode)")
                return
            }
            call?.resolve(["success": true])
        }
    }
    
    @objc func streamPortfolioImport(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let fileName = call.getString("fileName"),
              let mimeType = call.getString("mimeType"),
              let vaultOwnerToken = call.getString("vaultOwnerToken"),
              let fileBase64 = call.getString("fileBase64") else {
            call.reject("Missing required parameters: userId, fileName, mimeType, vaultOwnerToken, fileBase64")
            return
        }
        guard let fileData = Data(base64Encoded: fileBase64) else {
            call.reject("Invalid base64 file content")
            return
        }
        if streamCall != nil {
            call.reject("A stream is already in progress")
            return
        }
        
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/portfolio/import/stream"
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"user_id\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(userId)\r\n".data(using: .utf8)!)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body
        
        streamCall = call
        streamBuffer = ""
        streamSession = makeStreamSession()
        streamTask = streamSession?.dataTask(with: request)
        streamTask?.resume()
    }
    
    @objc func streamPortfolioAnalyzeLosers(_ call: CAPPluginCall) {
        guard let bodyJson = call.getObject("body"),
              let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            call.reject("Missing required parameters: body, vaultOwnerToken")
            return
        }
        if streamCall != nil {
            call.reject("A stream is already in progress")
            return
        }
        
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/portfolio/analyze-losers/stream"
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        guard let bodyData = try? JSONSerialization.data(withJSONObject: bodyJson) else {
            call.reject("Invalid body JSON")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = bodyData
        
        streamCall = call
        streamBuffer = ""
        streamSession = makeStreamSession()
        streamTask = streamSession?.dataTask(with: request)
        streamTask?.resume()
    }
    
    // MARK: - Chat Methods
    
    @objc func chat(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 chat called")
        
        guard let userId = call.getString("userId"),
              let message = call.getString("message"),
              let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            print("[\(TAG)] ❌ Missing required parameters: userId, message, vaultOwnerToken")
            call.reject("Missing required parameters: userId, message, vaultOwnerToken")
            return
        }
        
        let conversationId = call.getString("conversationId")
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/chat"
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Use VAULT_OWNER token for consent-gated access
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        
        var body: [String: Any] = [
            "user_id": userId,
            "message": message
        ]
        
        if let convId = conversationId {
            body["conversation_id"] = convId
        }
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }
            
            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ chat success")
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func getInitialChatState(_ call: CAPPluginCall) {
        print("[\(TAG)] 🔍 getInitialChatState called")
        
        guard let userId = call.getString("userId") else {
            print("[\(TAG)] ❌ Missing required parameter: userId")
            call.reject("Missing required parameter: userId")
            return
        }
        
        // Consent-gated: requires VAULT_OWNER token
        guard let vaultOwnerToken = call.getString("vaultOwnerToken"), !vaultOwnerToken.isEmpty else {
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        let backendUrl = getBackendUrl(call)
        let urlStr = "\(backendUrl)/api/kai/chat/initial-state/\(userId)"
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                let errorMsg = "Network error: \(error.localizedDescription) | backendUrl: \(backendUrl)"
                print("[\(self.TAG)] ❌ \(errorMsg)")
                call.reject(errorMsg)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
                if !(200...299).contains(httpResponse.statusCode) {
                    let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                    let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                    let errorMsg = "HTTP Error \(httpResponse.statusCode) | backendUrl: \(backendUrl) | body: \(truncatedBody)"
                    print("[\(self.TAG)] ❌ \(errorMsg)")
                    call.reject(errorMsg)
                    return
                }
            }
            
            guard let data = data else {
                print("[\(self.TAG)] ❌ No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("[\(self.TAG)] ✅ getInitialChatState success")
                    call.resolve(json)
                } else {
                    print("[\(self.TAG)] ❌ Invalid response format")
                    call.reject("Invalid response format")
                }
            } catch {
                print("[\(self.TAG)] ❌ JSON parsing error: \(error.localizedDescription)")
                call.reject("JSON parsing error: \(error.localizedDescription)")
            }
        }.resume()
    }
}
