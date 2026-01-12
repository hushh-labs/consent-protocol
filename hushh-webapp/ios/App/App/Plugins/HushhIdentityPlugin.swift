import UIKit
import Capacitor

/**
 * HushhIdentityPlugin - Investor Identity Resolution (Capacitor 8)
 *
 * Handles investor identity detection and confirmation for Kai onboarding.
 * Separate modular plugin following existing pattern.
 *
 * Methods:
 * - autoDetect: Detect investor from Firebase displayName
 * - searchInvestors: Search investor profiles by name
 * - getInvestor: Get full investor profile by ID
 * - confirmIdentity: Encrypt profile and save to vault
 * - getIdentityStatus: Check if user has confirmed identity
 */
@objc(HushhIdentityPlugin)
public class HushhIdentityPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "HushhIdentityPlugin"
    public let jsName = "HushhIdentity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "autoDetect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "searchInvestors", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getInvestor", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "confirmIdentity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getIdentityStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEncryptedProfile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetIdentity", returnType: CAPPluginReturnPromise)
    ]
    
    private let TAG = "HushhIdentity"
    
    private var defaultBackendUrl: String {
        let configUrl = bridge?.config.getPluginConfig(jsName).getString("backendUrl")
        if configUrl != nil {
            print("[\(TAG)] 🔧 Using config backendUrl: \(configUrl!)")
        }
        return configUrl ?? "https://consent-protocol-1006304528804.us-central1.run.app"
    }
    
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()
    
    // MARK: - Auto Detect Investor
    /**
     * Auto-detect investor from Firebase displayName.
     * Sends Firebase ID token to backend which extracts displayName and searches investor_profiles.
     */
    @objc func autoDetect(_ call: CAPPluginCall) {
        guard let authToken = call.getString("authToken") else {
            print("[\(TAG)] ❌ autoDetect: Missing authToken")
            call.reject("Missing required parameter: authToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/identity/auto-detect"
        
        print("[\(TAG)] 🔍 Auto-detecting investor...")
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL: \(urlStr)")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Auto-detect network error: \(error.localizedDescription)")
                call.reject("Auto-detect failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [\(self.TAG)] Auto-detect: Invalid response type")
                call.reject("Invalid response")
                return
            }
            
            print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
            
            // Check HTTP status code
            guard (200...299).contains(httpResponse.statusCode) else {
                let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                print("❌ [\(self.TAG)] Auto-detect failed: HTTP \(httpResponse.statusCode) | body: \(truncatedBody)")
                call.reject("Auto-detect failed: HTTP \(httpResponse.statusCode)")
                return
            }
            
            guard let data = data else {
                print("❌ [\(self.TAG)] Auto-detect: No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Auto-detect response received: \(json.keys)")
                    call.resolve(json)
                } else {
                    print("❌ [\(self.TAG)] Auto-detect: Invalid JSON format")
                    call.reject("Invalid JSON response")
                }
            } catch {
                print("❌ [\(self.TAG)] Auto-detect parse error: \(error.localizedDescription)")
                call.reject("Failed to parse response: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Search Investors
    /**
     * Search investor profiles by name (public endpoint, no auth required).
     */
    @objc func searchInvestors(_ call: CAPPluginCall) {
        guard let name = call.getString("name") else {
            print("[\(TAG)] ❌ searchInvestors: Missing name parameter")
            call.reject("Missing required parameter: name")
            return
        }
        
        let limit = call.getInt("limit") ?? 10
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/investors/search?name=\(name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? name)&limit=\(limit)"
        
        guard let encodedName = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(backendUrl)/api/investors/search?name=\(encodedName)&limit=\(limit)") else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] 🔍 Searching investors for: \(name)")
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Search network error: \(error.localizedDescription)")
                call.reject("Search failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [\(self.TAG)] Search: Invalid response type")
                call.reject("Invalid response")
                return
            }
            
            print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
            
            // Check HTTP status code
            guard (200...299).contains(httpResponse.statusCode) else {
                let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                print("❌ [\(self.TAG)] Search failed: HTTP \(httpResponse.statusCode) | body: \(truncatedBody)")
                call.reject("Search failed: HTTP \(httpResponse.statusCode)")
                return
            }
            
            guard let data = data else {
                print("❌ [\(self.TAG)] Search: No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let jsonArray = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                    print("✅ [\(self.TAG)] Found \(jsonArray.count) investors")
                    call.resolve(["investors": jsonArray])
                } else {
                    print("❌ [\(self.TAG)] Search: Invalid JSON format")
                    call.reject("Invalid JSON response")
                }
            } catch {
                print("❌ [\(self.TAG)] Search parse error: \(error.localizedDescription)")
                call.reject("Failed to parse response: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Get Investor
    /**
     * Get full investor profile by ID (public endpoint, no auth required).
     */
    @objc func getInvestor(_ call: CAPPluginCall) {
        guard let investorId = call.getInt("id") else {
            print("[\(TAG)] ❌ getInvestor: Missing id parameter")
            call.reject("Missing required parameter: id")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/investors/\(investorId)"
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] 📋 Getting investor \(investorId)")
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Get investor network error: \(error.localizedDescription)")
                call.reject("Get investor failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [\(self.TAG)] Get investor: Invalid response type")
                call.reject("Invalid response")
                return
            }
            
            print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
            
            // Check HTTP status code
            guard (200...299).contains(httpResponse.statusCode) else {
                let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                print("❌ [\(self.TAG)] Get investor failed: HTTP \(httpResponse.statusCode) | body: \(truncatedBody)")
                if httpResponse.statusCode == 404 {
                    call.reject("Investor not found")
                } else {
                    call.reject("Get investor failed: HTTP \(httpResponse.statusCode)")
                }
                return
            }
            
            guard let data = data else {
                print("❌ [\(self.TAG)] Get investor: No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Got investor profile: \(json.keys)")
                    call.resolve(json)
                } else {
                    print("❌ [\(self.TAG)] Get investor: Invalid JSON format")
                    call.reject("Invalid JSON response")
                }
            } catch {
                print("❌ [\(self.TAG)] Get investor parse error: \(error.localizedDescription)")
                call.reject("Failed to parse response: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Confirm Identity
    /**
     * Confirm identity and save encrypted profile to vault.
     * Requires VAULT_OWNER token.
     */
    @objc func confirmIdentity(_ call: CAPPluginCall) {
        guard let vaultOwnerToken = call.getString("vaultOwnerToken"),
              let investorId = call.getInt("investorId"),
              let profileDataCiphertext = call.getString("profileDataCiphertext"),
              let profileDataIv = call.getString("profileDataIv"),
              let profileDataTag = call.getString("profileDataTag") else {
            print("[\(TAG)] ❌ confirmIdentity: Missing required parameters")
            call.reject("Missing required parameters")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/identity/confirm"
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] ✍️ Confirming identity for investor \(investorId)")
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        let body: [String: Any] = [
            "investor_id": investorId,
            "profile_data_ciphertext": profileDataCiphertext,
            "profile_data_iv": profileDataIv,
            "profile_data_tag": profileDataTag
        ]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            print("❌ [\(self.TAG)] confirmIdentity: Failed to serialize body")
            call.reject("Failed to serialize body")
            return
        }
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Confirm network error: \(error.localizedDescription)")
                call.reject("Confirm failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [\(self.TAG)] Confirm: Invalid response type")
                call.reject("Invalid response")
                return
            }
            
            print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                print("❌ [\(self.TAG)] Confirm failed: HTTP \(httpResponse.statusCode) | body: \(truncatedBody)")
                
                let errorMsg: String
                if let data = data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let detail = json["detail"] as? String ?? json["message"] as? String {
                    errorMsg = detail
                } else {
                    errorMsg = "Confirm failed: HTTP \(httpResponse.statusCode)"
                }
                call.reject(errorMsg)
                return
            }
            
            guard let data = data else {
                print("❌ [\(self.TAG)] Confirm: No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Identity confirmed!")
                    call.resolve(json)
                } else {
                    print("❌ [\(self.TAG)] Confirm: Invalid JSON format")
                    call.reject("Invalid JSON response")
                }
            } catch {
                print("❌ [\(self.TAG)] Confirm parse error: \(error.localizedDescription)")
                call.reject("Failed to parse response: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Get Identity Status
    /**
     * Check if user has confirmed an identity.
     * Requires VAULT_OWNER token.
     */
    @objc func getIdentityStatus(_ call: CAPPluginCall) {
        guard let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            print("[\(TAG)] ❌ getIdentityStatus: Missing vaultOwnerToken")
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/identity/status"
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] 📊 Getting identity status")
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Get status network error: \(error.localizedDescription)")
                call.reject("Get status failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [\(self.TAG)] Get status: Invalid response type")
                call.reject("Invalid response")
                return
            }
            
            print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
            
            // Check HTTP status code
            guard (200...299).contains(httpResponse.statusCode) else {
                let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                print("❌ [\(self.TAG)] Get status failed: HTTP \(httpResponse.statusCode) | body: \(truncatedBody)")
                call.reject("Get status failed: HTTP \(httpResponse.statusCode)")
                return
            }
            
            guard let data = data else {
                print("❌ [\(self.TAG)] Get status: No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Got identity status: \(json.keys)")
                    call.resolve(json)
                } else {
                    print("❌ [\(self.TAG)] Get status: Invalid JSON format")
                    call.reject("Invalid JSON response")
                }
            } catch {
                print("❌ [\(self.TAG)] Get status parse error: \(error.localizedDescription)")
                call.reject("Failed to parse response: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Get Encrypted Profile
    /**
     * Get encrypted investor profile (ciphertext).
     * Requires VAULT_OWNER token.
     */
    @objc func getEncryptedProfile(_ call: CAPPluginCall) {
        guard let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            print("[\(TAG)] ❌ getEncryptedProfile: Missing vaultOwnerToken")
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/identity/profile"
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] 🔐 Getting encrypted profile")
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        let body: [String: Any] = ["consent_token": vaultOwnerToken]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            print("❌ [\(self.TAG)] getEncryptedProfile: Failed to serialize body")
            call.reject("Failed to serialize body")
            return
        }
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Get encrypted profile network error: \(error.localizedDescription)")
                call.reject("Get profile failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [\(self.TAG)] Get encrypted profile: Invalid response type")
                call.reject("Invalid response")
                return
            }
            
            print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
            
            // Check HTTP status code
            guard (200...299).contains(httpResponse.statusCode) else {
                let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                print("❌ [\(self.TAG)] Get encrypted profile failed: HTTP \(httpResponse.statusCode) | body: \(truncatedBody)")
                if httpResponse.statusCode == 404 {
                    call.reject("Profile not found")
                } else {
                    call.reject("Get profile failed: HTTP \(httpResponse.statusCode)")
                }
                return
            }
            
            guard let data = data else {
                print("❌ [\(self.TAG)] Get encrypted profile: No data received")
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Got encrypted profile: \(json.keys)")
                    call.resolve(json)
                } else {
                    print("❌ [\(self.TAG)] Get encrypted profile: Invalid JSON format")
                    call.reject("Invalid JSON response")
                }
            } catch {
                print("❌ [\(self.TAG)] Get encrypted profile parse error: \(error.localizedDescription)")
                call.reject("Failed to parse response: \(error.localizedDescription)")
            }
        }.resume()
    }
    
    // MARK: - Reset Identity
    /**
     * Delete user's confirmed identity.
     * Requires VAULT_OWNER token.
     */
    @objc func resetIdentity(_ call: CAPPluginCall) {
        guard let vaultOwnerToken = call.getString("vaultOwnerToken") else {
            print("[\(TAG)] ❌ resetIdentity: Missing vaultOwnerToken")
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/identity/profile"
        
        guard let url = URL(string: urlStr) else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] 🗑️ Resetting identity")
        print("[\(TAG)] 🌐 URL: \(urlStr)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.addValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Reset network error: \(error.localizedDescription)")
                call.reject("Reset failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ [\(self.TAG)] Reset: Invalid response type")
                call.reject("Invalid response")
                return
            }
            
            print("[\(self.TAG)] 📡 Response status: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let bodyStr = data.flatMap { String(data: $0, encoding: .utf8) } ?? "no body"
                let truncatedBody = bodyStr.count > 200 ? String(bodyStr.prefix(200)) + "..." : bodyStr
                print("❌ [\(self.TAG)] Reset failed: HTTP \(httpResponse.statusCode) | body: \(truncatedBody)")
                
                let errorMsg: String
                if let data = data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let detail = json["detail"] as? String ?? json["error"] as? String {
                    errorMsg = detail
                } else {
                    errorMsg = "Reset failed: HTTP \(httpResponse.statusCode)"
                }
                call.reject(errorMsg)
                return
            }
            
            // Parse response if available, otherwise return success
            let result: [String: Any]
            if let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                result = json
            } else {
                result = ["success": true]
            }
            
            print("✅ [\(self.TAG)] Identity reset successfully")
            call.resolve(result)
        }.resume()
    }
}
