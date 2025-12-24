/**
 * Hushh Auth Plugin - Native iOS Google Sign-In
 * 
 * Production-grade authentication using native Google Sign-In SDK.
 * Returns credentials compatible with Firebase signInWithCredential().
 * 
 * Flow:
 *   1. Native Google Sign-In UI
 *   2. Returns idToken + accessToken
 *   3. Frontend syncs with Firebase using GoogleAuthProvider.credential()
 */

import Foundation
import Capacitor
import AuthenticationServices

// MARK: - Plugin Registration

@objc(HushhAuthPlugin)
public class HushhAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    
    public let identifier = "HushhAuthPlugin"
    public let jsName = "HushhAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getIdToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentUser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSignedIn", returnType: CAPPluginReturnPromise),
    ]
    
    // MARK: - Stored User Data
    
    private var currentUser: AuthUser?
    private var currentIdToken: String?
    private var currentAccessToken: String?
    
    // MARK: - Configuration
    
    /// Google OAuth Client ID for iOS (from GoogleService-Info.plist or Info.plist)
    private var clientID: String? {
        // Try to get from Info.plist first
        if let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String {
            return clientID
        }
        // Fallback to GoogleService-Info.plist
        if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
           let plist = NSDictionary(contentsOfFile: path),
           let clientID = plist["CLIENT_ID"] as? String {
            return clientID
        }
        return nil
    }
    
    // MARK: - Sign In
    
    @objc func signIn(_ call: CAPPluginCall) {
        guard let clientID = self.clientID else {
            call.reject("Missing Google Client ID. Add GIDClientID to Info.plist or GoogleService-Info.plist")
            return
        }
        
        DispatchQueue.main.async {
            self.performSignIn(clientID: clientID, call: call)
        }
    }
    
    private func performSignIn(clientID: String, call: CAPPluginCall) {
        // Use ASWebAuthenticationSession for OAuth flow
        // This is the recommended approach for iOS 13+ and works in Capacitor apps
        
        let nonce = generateNonce()
        let state = generateNonce()
        
        // Build Google OAuth URL
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: "com.hushh.pda:/oauth2callback"),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "nonce", value: nonce),
            URLQueryItem(name: "prompt", value: "select_account"),
        ]
        
        guard let authURL = components.url else {
            call.reject("Failed to build auth URL")
            return
        }
        
        // Get the presenting view controller
        guard let viewController = self.bridge?.viewController else {
            call.reject("No view controller available")
            return
        }
        
        // Use ASWebAuthenticationSession
        let session = ASWebAuthenticationSession(
            url: authURL,
            callbackURLScheme: "com.hushh.pda"
        ) { [weak self] callbackURL, error in
            if let error = error {
                if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                    call.reject("User cancelled sign-in", "USER_CANCELLED")
                } else {
                    call.reject("Sign-in failed: \(error.localizedDescription)")
                }
                return
            }
            
            guard let callbackURL = callbackURL,
                  let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                    .queryItems?.first(where: { $0.name == "code" })?.value else {
                call.reject("No authorization code received")
                return
            }
            
            // Exchange code for tokens
            self?.exchangeCodeForTokens(code: code, clientID: clientID, call: call)
        }
        
        session.presentationContextProvider = viewController as? ASWebAuthenticationPresentationContextProviding
        session.prefersEphemeralWebBrowserSession = false
        
        if !session.start() {
            call.reject("Failed to start authentication session")
        }
    }
    
    private func exchangeCodeForTokens(code: String, clientID: String, call: CAPPluginCall) {
        // Exchange authorization code for tokens
        let tokenURL = URL(string: "https://oauth2.googleapis.com/token")!
        
        var request = URLRequest(url: tokenURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "code": code,
            "client_id": clientID,
            "redirect_uri": "com.hushh.pda:/oauth2callback",
            "grant_type": "authorization_code",
        ]
        
        request.httpBody = body.map { "\($0.key)=\($0.value)" }.joined(separator: "&").data(using: .utf8)
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                call.reject("Token exchange failed: \(error.localizedDescription)")
                return
            }
            
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                call.reject("Failed to parse token response")
                return
            }
            
            if let errorMsg = json["error"] as? String {
                call.reject("Token error: \(errorMsg)")
                return
            }
            
            guard let idToken = json["id_token"] as? String,
                  let accessToken = json["access_token"] as? String else {
                call.reject("Missing tokens in response")
                return
            }
            
            // Decode ID token to get user info
            self?.decodeIdTokenAndComplete(idToken: idToken, accessToken: accessToken, call: call)
        }.resume()
    }
    
    private func decodeIdTokenAndComplete(idToken: String, accessToken: String, call: CAPPluginCall) {
        // Decode JWT to get user info (ID token is a JWT)
        let parts = idToken.split(separator: ".")
        guard parts.count >= 2 else {
            call.reject("Invalid ID token format")
            return
        }
        
        var payload = String(parts[1])
        // Pad base64 if needed
        while payload.count % 4 != 0 {
            payload += "="
        }
        
        guard let payloadData = Data(base64Encoded: payload.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")),
              let claims = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any] else {
            call.reject("Failed to decode ID token")
            return
        }
        
        let user = AuthUser(
            id: claims["sub"] as? String ?? "",
            email: claims["email"] as? String ?? "",
            displayName: claims["name"] as? String ?? "",
            photoUrl: claims["picture"] as? String ?? "",
            emailVerified: claims["email_verified"] as? Bool ?? false
        )
        
        // Store for later use
        self.currentUser = user
        self.currentIdToken = idToken
        self.currentAccessToken = accessToken
        
        // Save to Keychain for persistence
        saveToKeychain(idToken: idToken, accessToken: accessToken, user: user)
        
        print("✅ [HushhAuth] Sign-in successful for: \(user.email)")
        
        call.resolve([
            "idToken": idToken,
            "accessToken": accessToken,
            "user": [
                "id": user.id,
                "email": user.email,
                "displayName": user.displayName,
                "photoUrl": user.photoUrl,
                "emailVerified": user.emailVerified
            ]
        ])
    }
    
    // MARK: - Sign Out
    
    @objc func signOut(_ call: CAPPluginCall) {
        currentUser = nil
        currentIdToken = nil
        currentAccessToken = nil
        
        // Clear from Keychain
        clearKeychain()
        
        print("✅ [HushhAuth] Signed out")
        call.resolve()
    }
    
    // MARK: - Get ID Token
    
    @objc func getIdToken(_ call: CAPPluginCall) {
        // Try memory first
        if let token = currentIdToken {
            call.resolve(["idToken": token])
            return
        }
        
        // Try Keychain
        if let token = loadIdTokenFromKeychain() {
            currentIdToken = token
            call.resolve(["idToken": token])
            return
        }
        
        call.resolve(["idToken": NSNull()])
    }
    
    // MARK: - Get Current User
    
    @objc func getCurrentUser(_ call: CAPPluginCall) {
        // Try memory first
        if let user = currentUser {
            call.resolve([
                "user": [
                    "id": user.id,
                    "email": user.email,
                    "displayName": user.displayName,
                    "photoUrl": user.photoUrl,
                    "emailVerified": user.emailVerified
                ]
            ])
            return
        }
        
        // Try Keychain
        if let user = loadUserFromKeychain() {
            currentUser = user
            call.resolve([
                "user": [
                    "id": user.id,
                    "email": user.email,
                    "displayName": user.displayName,
                    "photoUrl": user.photoUrl,
                    "emailVerified": user.emailVerified
                ]
            ])
            return
        }
        
        call.resolve(["user": NSNull()])
    }
    
    // MARK: - Is Signed In
    
    @objc func isSignedIn(_ call: CAPPluginCall) {
        let signedIn = currentIdToken != nil || loadIdTokenFromKeychain() != nil
        call.resolve(["signedIn": signedIn])
    }
    
    // MARK: - Keychain Helpers
    
    private let keychainService = "com.hushh.pda.auth"
    
    private func saveToKeychain(idToken: String, accessToken: String, user: AuthUser) {
        let keychain = KeychainHelper.shared
        keychain.save(idToken, forKey: "idToken", service: keychainService)
        keychain.save(accessToken, forKey: "accessToken", service: keychainService)
        
        if let userData = try? JSONEncoder().encode(user) {
            keychain.save(userData, forKey: "user", service: keychainService)
        }
    }
    
    private func loadIdTokenFromKeychain() -> String? {
        return KeychainHelper.shared.load(forKey: "idToken", service: keychainService)
    }
    
    private func loadUserFromKeychain() -> AuthUser? {
        guard let data: Data = KeychainHelper.shared.loadData(forKey: "user", service: keychainService) else {
            return nil
        }
        return try? JSONDecoder().decode(AuthUser.self, from: data)
    }
    
    private func clearKeychain() {
        let keychain = KeychainHelper.shared
        keychain.delete(forKey: "idToken", service: keychainService)
        keychain.delete(forKey: "accessToken", service: keychainService)
        keychain.delete(forKey: "user", service: keychainService)
    }
    
    // MARK: - Nonce Generation
    
    private func generateNonce(length: Int = 32) -> String {
        let charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._"
        var result = ""
        var remainingLength = length
        
        while remainingLength > 0 {
            let randoms: [UInt8] = (0..<16).map { _ in
                var random: UInt8 = 0
                _ = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
                return random
            }
            
            randoms.forEach { random in
                if remainingLength == 0 { return }
                if random < charset.count {
                    result.append(charset[charset.index(charset.startIndex, offsetBy: Int(random))])
                    remainingLength -= 1
                }
            }
        }
        
        return result
    }
}

// MARK: - Auth User Model

struct AuthUser: Codable {
    let id: String
    let email: String
    let displayName: String
    let photoUrl: String
    let emailVerified: Bool
}

// MARK: - Keychain Helper

class KeychainHelper {
    static let shared = KeychainHelper()
    private init() {}
    
    func save(_ value: String, forKey key: String, service: String) {
        guard let data = value.data(using: .utf8) else { return }
        save(data, forKey: key, service: service)
    }
    
    func save(_ data: Data, forKey key: String, service: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    func load(forKey key: String, service: String) -> String? {
        guard let data: Data = loadData(forKey: key, service: service) else { return nil }
        return String(data: data, encoding: .utf8)
    }
    
    func loadData(forKey key: String, service: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)
        return result as? Data
    }
    
    func delete(forKey key: String, service: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension UIViewController: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return self.view.window ?? ASPresentationAnchor()
    }
}
