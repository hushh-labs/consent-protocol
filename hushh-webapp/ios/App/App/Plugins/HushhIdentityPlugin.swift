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
        return (bridge?.config.getPluginConfig(jsName).getString("backendUrl")) ?? "https://consent-protocol-1006304528804.us-central1.run.app"
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
            call.reject("Missing required parameter: authToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/api/identity/auto-detect"
        
        print("[\(TAG)] Auto-detecting investor...")
        
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
                print("❌ [\(self.TAG)] Auto-detect error: \(error.localizedDescription)")
                call.reject("Auto-detect failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                call.reject("Invalid response")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Auto-detect response received")
                    call.resolve(json)
                } else {
                    call.reject("Invalid JSON response")
                }
            } catch {
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
            call.reject("Missing required parameter: name")
            return
        }
        
        let limit = call.getInt("limit") ?? 10
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let encodedName = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(backendUrl)/api/investors/search?name=\(encodedName)&limit=\(limit)") else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] Searching investors for: \(name)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Search error: \(error.localizedDescription)")
                call.reject("Search failed: \(error.localizedDescription)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let jsonArray = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                    print("✅ [\(self.TAG)] Found \(jsonArray.count) investors")
                    call.resolve(["investors": jsonArray])
                } else {
                    call.reject("Invalid JSON response")
                }
            } catch {
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
            call.reject("Missing required parameter: id")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let url = URL(string: "\(backendUrl)/api/investors/\(investorId)") else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] Getting investor \(investorId)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Get investor error: \(error.localizedDescription)")
                call.reject("Get investor failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                call.reject("Invalid response")
                return
            }
            
            if httpResponse.statusCode == 404 {
                call.reject("Investor not found")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Got investor profile")
                    call.resolve(json)
                } else {
                    call.reject("Invalid JSON response")
                }
            } catch {
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
            call.reject("Missing required parameters")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let url = URL(string: "\(backendUrl)/api/identity/confirm") else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] Confirming identity for investor \(investorId)")
        
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
            call.reject("Failed to serialize body")
            return
        }
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Confirm error: \(error.localizedDescription)")
                call.reject("Confirm failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                call.reject("Invalid response")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 {
                        print("✅ [\(self.TAG)] Identity confirmed!")
                        call.resolve(json)
                    } else {
                        let detail = json["detail"] as? String ?? "Unknown error"
                        call.reject(detail)
                    }
                } else {
                    call.reject("Invalid JSON response")
                }
            } catch {
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
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let url = URL(string: "\(backendUrl)/api/identity/status") else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] Getting identity status")
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                call.reject("Get status failed: \(error.localizedDescription)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Got identity status")
                    call.resolve(json)
                } else {
                    call.reject("Invalid JSON response")
                }
            } catch {
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
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let url = URL(string: "\(backendUrl)/api/identity/profile") else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] Getting encrypted profile")
        
        let body: [String: Any] = ["consent_token": vaultOwnerToken]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            call.reject("Failed to serialize body")
            return
        }
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Get encrypted profile error: \(error.localizedDescription)")
                call.reject("Get profile failed: \(error.localizedDescription)")
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                call.reject("Invalid response")
                return
            }
            
            if httpResponse.statusCode == 404 {
                call.reject("Profile not found")
                return
            }
            
            guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
                call.reject("Get profile failed: HTTP \(httpResponse.statusCode)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("✅ [\(self.TAG)] Got encrypted profile")
                    call.resolve(json)
                } else {
                    call.reject("Invalid JSON response")
                }
            } catch {
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
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        
        guard let url = URL(string: "\(backendUrl)/api/identity/profile") else {
            call.reject("Invalid URL")
            return
        }
        
        print("[\(TAG)] Resetting identity")
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.addValue("Bearer \(vaultOwnerToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        urlSession.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                call.reject("Reset failed: \(error.localizedDescription)")
                return
            }
            
            print("✅ [\(self.TAG)] Identity reset")
            call.resolve(["success": true])
        }.resume()
    }
}
