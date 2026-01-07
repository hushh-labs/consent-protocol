import Capacitor
import Foundation

/**
 * Kai Plugin - iOS Implementation
 * 
 * Native plugin for Agent Kai stock analysis.
 * Makes HTTP calls to backend from native code.
 */

@objc(KaiPlugin)
public class KaiPlugin: CAPPlugin {
    
    // MARK: - Configuration
    
    private func getBackendUrl() -> String {
        // Read from capacitor config or environment
        if let backendUrl = getConfigValue("backendUrl") as? String {
            return backendUrl
        }
        
        // Default to localhost for development
        // iOS simulator can access host machine's localhost directly
        return "http://localhost:8000"
    }
    
    // MARK: - Plugin Methods
    
    @objc func grantConsent(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let scopes = call.getArray("scopes", String.self) else {
            call.reject("Missing required parameters: userId, scopes")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl()
        let url = URL(string: "\\(backendUrl)/api/kai/consent/grant")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "user_id": userId,
            "scopes": scopes
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject("Network error: \\(error.localizedDescription)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    call.resolve(json)
                } else {
                    call.reject("Invalid response format")
                }
            } catch {
                call.reject("JSON parsing error: \\(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func analyze(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let ticker = call.getString("ticker"),
              let consentToken = call.getString("consentToken"),
              let riskProfile = call.getString("riskProfile"),
              let processingMode = call.getString("processingMode") else {
            call.reject("Missing required parameters")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl()
        let url = URL(string: "\\(backendUrl)/api/kai/analyze")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "user_id": userId,
            "ticker": ticker,
            "consent_token": consentToken,
            "risk_profile": riskProfile,
            "processing_mode": processingMode
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject("Network error: \\(error.localizedDescription)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    call.resolve(["decision": json])
                } else {
                    call.reject("Invalid response format")
                }
            } catch {
                call.reject("JSON parsing error: \\(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func storePreferences(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let preferencesEncrypted = call.getString("preferencesEncrypted") else {
            call.reject("Missing required parameters")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl()
        let url = URL(string: "\\(backendUrl)/api/kai/preferences/store")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body: [String: Any] = [
            "user_id": userId,
            "preferences_encrypted": preferencesEncrypted
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject("Network error: \\(error.localizedDescription)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    call.resolve(json)
                } else {
                    call.reject("Invalid response format")
                }
            } catch {
                call.reject("JSON parsing error: \\(error.localizedDescription)")
            }
        }.resume()
    }
    
    @objc func getPreferences(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing required parameter: userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = getBackendUrl()
        let url = URL(string: "\\(backendUrl)/api/kai/preferences/\\(userId)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authToken {
            request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                call.reject("Network error: \\(error.localizedDescription)")
                return
            }
            
            guard let data = data else {
                call.reject("No data received")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    call.resolve(json)
                } else {
                    call.reject("Invalid response format")
                }
            } catch {
                call.reject("JSON parsing error: \\(error.localizedDescription)")
            }
        }.resume()
    }
}
