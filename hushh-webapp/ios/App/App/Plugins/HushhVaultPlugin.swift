import UIKit
import Capacitor
import CryptoKit
import CommonCrypto

/**
 * HushhVaultPlugin - Native iOS Vault Operations (Capacitor 8)
 *
 * Uses CAPBridgedPlugin protocol with pluginMethods array.
 */
@objc(HushhVaultPlugin)
public class HushhVaultPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "HushhVaultPlugin"
    public let jsName = "HushhVault"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "deriveKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "encryptData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decryptData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setupVault", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getFoodPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProfessionalData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storePreferencesToCloud", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storePreference", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPreferences", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deletePreferences", returnType: CAPPluginReturnPromise),
        // Consent methods called by ApiService
        CAPPluginMethod(name: "getPendingConsents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getActiveConsents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getConsentHistory", returnType: CAPPluginReturnPromise)
    ]
    
    private let TAG = "HushhVault"
    private var defaultBackendUrl: String {
        return (bridge?.config.getPluginConfig(jsName).getString("backendUrl")) ?? "https://consent-protocol-1006304528804.us-central1.run.app"
    }
    
    // URLSession with 30s timeout (matching Android)
    private lazy var urlSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()
    
    // MARK: - Key Derivation (PBKDF2)
    @objc func deriveKey(_ call: CAPPluginCall) {
        guard let password = call.getString("password"),
              let salt = call.getString("salt") else {
            call.reject("Missing password or salt")
            return
        }
        
        let iterations = call.getInt("iterations") ?? 100000
        let keyLength = call.getInt("keyLength") ?? 32
        
        DispatchQueue.global(qos: .userInitiated).async {
            guard let saltData = salt.data(using: .utf8),
                  let passwordData = password.data(using: .utf8) else {
                call.reject("Invalid input encoding")
                return
            }
            
            var derivedKey = [UInt8](repeating: 0, count: keyLength)
            let status = passwordData.withUnsafeBytes { passwordBytes in
                saltData.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordBytes.baseAddress?.assumingMemoryBound(to: Int8.self),
                        passwordData.count,
                        saltBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        saltData.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        &derivedKey,
                        keyLength
                    )
                }
            }
            
            if status == kCCSuccess {
                let hexKey = derivedKey.map { String(format: "%02x", $0) }.joined()
                call.resolve(["key": hexKey])
            } else {
                call.reject("Key derivation failed")
            }
        }
    }
    
    // MARK: - Encrypt (AES-GCM)
    @objc func encryptData(_ call: CAPPluginCall) {
        guard let plaintext = call.getString("plaintext"),
              let keyHex = call.getString("key") else {
            call.reject("Missing plaintext or key")
            return
        }
        
        guard let keyData = Data(hexString: keyHex),
              let plaintextData = plaintext.data(using: .utf8) else {
            call.reject("Invalid encoding")
            return
        }
        
        do {
            let key = SymmetricKey(data: keyData)
            let sealedBox = try AES.GCM.seal(plaintextData, using: key)
            
            call.resolve([
                "ciphertext": sealedBox.ciphertext.base64EncodedString(),
                "iv": sealedBox.nonce.withUnsafeBytes { Data($0).base64EncodedString() },
                "tag": sealedBox.tag.base64EncodedString()
            ])
        } catch {
            call.reject("Encryption failed: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Decrypt (AES-GCM)
    @objc func decryptData(_ call: CAPPluginCall) {
        guard let ciphertext = call.getString("ciphertext"),
              let iv = call.getString("iv"),
              let tag = call.getString("tag"),
              let keyHex = call.getString("key") else {
            call.reject("Missing required parameters")
            return
        }
        
        guard let keyData = Data(hexString: keyHex),
              let ciphertextData = Data(base64Encoded: ciphertext),
              let ivData = Data(base64Encoded: iv),
              let tagData = Data(base64Encoded: tag) else {
            call.reject("Invalid encoding")
            return
        }
        
        do {
            let key = SymmetricKey(data: keyData)
            let nonce = try AES.GCM.Nonce(data: ivData)
            let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertextData, tag: tagData)
            let decryptedData = try AES.GCM.open(sealedBox, using: key)
            
            if let plaintext = String(data: decryptedData, encoding: .utf8) {
                call.resolve(["plaintext": plaintext])
            } else {
                call.reject("Failed to decode plaintext")
            }
        } catch {
            call.reject("Decryption failed: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Vault Operations
    @objc func hasVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/db/vault/check"
        
        performRequest(urlStr: urlStr, body: ["userId": userId], authToken: authToken) { json, error in
            if let json = json, let hasVault = json["hasVault"] as? Bool {
                call.resolve(["exists": hasVault])
            } else {
                call.resolve(["exists": false])
            }
        }
    }
    
    @objc func getVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/db/vault/get"
        
        performRequest(urlStr: urlStr, body: ["userId": userId], authToken: authToken) { json, error in
            if let json = json {
                call.resolve(json as [String: Any])
            } else if let error = error, error.contains("404") {
                call.resolve(["vault": NSNull()])
            } else {
                call.reject(error ?? "Failed to get vault")
            }
        }
    }
    
    @objc func setupVault(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let encryptedKey = call.getString("encryptedKey"),
              let salt = call.getString("salt") else {
            call.reject("Missing required parameters")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/db/vault/create"
        
        let body: [String: Any] = [
            "userId": userId,
            "encryptedMasterKey": encryptedKey,
            "salt": salt
        ]
        
        performRequest(urlStr: urlStr, body: body, authToken: authToken) { json, error in
            if json != nil {
                call.resolve(["success": true])
            } else {
                call.reject(error ?? "Failed to create vault")
            }
        }
    }
    
    // MARK: - Domain Data
    @objc func getFoodPreferences(_ call: CAPPluginCall) {
        fetchDomainData(domain: "food", call: call)
    }
    
    @objc func getProfessionalData(_ call: CAPPluginCall) {
        fetchDomainData(domain: "professional", call: call)
    }
    
    private func fetchDomainData(domain: String, call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/db/\(domain)/get"
        
        performRequest(urlStr: urlStr, body: ["userId": userId], authToken: authToken) { json, error in
            if let json = json {
                call.resolve(["domain": domain, "preferences": json["preferences"] ?? NSNull()])
            } else {
                call.resolve(["domain": domain, "preferences": NSNull()])
            }
        }
    }
    
    @objc func storePreferencesToCloud(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"),
              let domain = call.getString("domain"),
              let fieldName = call.getString("fieldName"),
              let ciphertext = call.getString("ciphertext"),
              let iv = call.getString("iv"),
              let tag = call.getString("tag") else {
            call.reject("Missing params")
            return
        }
        
        let authToken = call.getString("authToken")
        let backendUrl = call.getString("backendUrl") ?? defaultBackendUrl
        let urlStr = "\(backendUrl)/db/\(domain)/store"
        
        let body: [String: Any] = [
            "userId": userId,
            "fieldName": fieldName,
            "ciphertext": ciphertext,
            "iv": iv,
            "tag": tag
        ]
        
        performRequest(urlStr: urlStr, body: body, authToken: authToken) { _, error in
            if error == nil {
                call.resolve(["success": true, "field": fieldName])
            } else {
                call.reject(error ?? "Store failed")
            }
        }
    }
    
    // MARK: - Placeholders
    @objc func storePreference(_ call: CAPPluginCall) { call.resolve() }
    @objc func getPreferences(_ call: CAPPluginCall) { call.resolve(["preferences": [:]]) }
    @objc func deletePreferences(_ call: CAPPluginCall) { call.resolve() }
    
    // MARK: - Consent Integration Methods (Called by ApiService on native)
    
    @objc func getPendingConsents(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let urlStr = "\(defaultBackendUrl)/api/consent/pending?userId=\(userId)"
        
        performGetRequest(urlStr: urlStr, authToken: authToken) { result, error in
            if let dict = result as? [String: Any], let pending = dict["pending"] as? [[String: Any]] {
                call.resolve(["pending": pending])
            } else if let array = result as? [[String: Any]] {
                call.resolve(["pending": array])
            } else {
                call.resolve(["pending": []])
            }
        }
    }
    
    @objc func getActiveConsents(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        let authToken = call.getString("authToken")
        let urlStr = "\(defaultBackendUrl)/api/consent/active?userId=\(userId)"
        
        performGetRequest(urlStr: urlStr, authToken: authToken) { result, error in
            if let dict = result as? [String: Any], let active = dict["active"] as? [[String: Any]] {
                call.resolve(["active": active])
            } else if let array = result as? [[String: Any]] {
                call.resolve(["active": array])
            } else {
                call.resolve(["active": []])
            }
        }
    }
    
    @objc func getConsentHistory(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("Missing userId")
            return
        }
        
        let page = call.getInt("page") ?? 1
        let limit = call.getInt("limit") ?? 50
        let authToken = call.getString("authToken")
        let urlStr = "\(defaultBackendUrl)/api/consent/history?userId=\(userId)&page=\(page)&limit=\(limit)"
        
        performGetRequest(urlStr: urlStr, authToken: authToken) { result, error in
            if let dict = result as? [String: Any], let items = dict["items"] as? [[String: Any]] {
                call.resolve(["items": items])
            } else if let array = result as? [[String: Any]] {
                call.resolve(["items": array])
            } else {
                call.resolve(["items": []])
            }
        }
    }
    
    // GET request helper (for consent endpoints)
    private func performGetRequest(urlStr: String, authToken: String?, completion: @escaping (Any?, String?) -> Void) {
        guard let url = URL(string: urlStr) else {
            completion(nil, "Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(nil, error.localizedDescription)
                return
            }
            
            guard let data = data else {
                completion(nil, "No data")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
                completion(nil, "HTTP \(httpResponse.statusCode)")
                return
            }
            
            do {
                let json = try JSONSerialization.jsonObject(with: data)
                completion(json, nil)
            } catch {
                completion(nil, "Parse error")
            }
        }.resume()
    }
    
    // MARK: - HTTP Helper
    private func performRequest(urlStr: String, body: [String: Any], authToken: String?, completion: @escaping ([String: Any]?, String?) -> Void) {
        guard let url = URL(string: urlStr) else {
            completion(nil, "Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(nil, "Failed to encode body")
            return
        }
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(nil, error.localizedDescription)
                return
            }
            
            guard let data = data else {
                completion(nil, "No data")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 404 {
                completion(nil, "404")
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    completion(json, nil)
                } else {
                    completion(nil, "Invalid JSON")
                }
            } catch {
                completion(nil, "Parse error")
            }
        }.resume()
    }
    
    // performRequestAny: returns Any to handle both Array and Dict responses
    private func performRequestAny(urlStr: String, body: [String: Any], authToken: String?, completion: @escaping (Any?, String?) -> Void) {
        guard let url = URL(string: urlStr) else {
            completion(nil, "Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(nil, "Failed to encode body")
            return
        }
        
        urlSession.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(nil, error.localizedDescription)
                return
            }
            
            guard let data = data else {
                completion(nil, "No data")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse, !(200...299).contains(httpResponse.statusCode) {
                completion(nil, "HTTP \(httpResponse.statusCode)")
                return
            }
            
            do {
                let json = try JSONSerialization.jsonObject(with: data)
                completion(json, nil)
            } catch {
                completion(nil, "Parse error")
            }
        }.resume()
    }
}

// MARK: - Data Extension for Hex
extension Data {
    init?(hexString: String) {
        var data = Data()
        var hex = hexString
        while hex.count >= 2 {
            let c = String(hex.prefix(2))
            hex = String(hex.dropFirst(2))
            if let byte = UInt8(c, radix: 16) {
                data.append(byte)
            } else {
                return nil
            }
        }
        self = data
    }
}
