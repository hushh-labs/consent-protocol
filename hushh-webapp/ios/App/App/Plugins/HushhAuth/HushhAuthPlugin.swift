/**
 * Hushh Auth Plugin - Native iOS Google Sign-In
 * 
 * Production-grade authentication using native Google Sign-In SDK.
 * Returns credentials compatible with Firebase signInWithCredential().
 * 
 * Flow:
 *   1. Native Google Sign-In UI (bottom sheet)
 *   2. Returns idToken + accessToken
 *   3. Frontend syncs with Firebase using GoogleAuthProvider.credential()
 */

import Foundation
import Capacitor
import GoogleSignIn

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

    // MARK: - Sign In (Native Google Sign-In SDK)
    
    @objc func signIn(_ call: CAPPluginCall) {
        NSLog("🍎 [HushhAuth] signIn() CALLED - Native plugin invoked!")
        
        guard let clientID = self.clientID else {
            NSLog("❌ [HushhAuth] Missing client ID!")
            call.reject("Missing Google Client ID. Add GIDClientID to Info.plist or GoogleService-Info.plist")
            return
        }
        
        NSLog("🍎 [HushhAuth] Got clientID, dispatching to main queue...")
        DispatchQueue.main.async { [weak self] in
            self?.performNativeSignIn(clientID: clientID, call: call)
        }
    }
    
    private func performNativeSignIn(clientID: String, call: CAPPluginCall) {
        print("🍎 [HushhAuth] performNativeSignIn called with clientID: \(clientID.prefix(20))...")
        
        // Configure Google Sign-In with client ID
        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config
        print("🍎 [HushhAuth] GIDSignIn configured")
        
        // Get the presenting view controller
        guard let viewController = self.bridge?.viewController else {
            print("❌ [HushhAuth] No view controller available!")
            call.reject("No view controller available")
            return
        }
        print("🍎 [HushhAuth] Got view controller, starting signIn...")
        
        // Perform native Google Sign-In
        GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { [weak self] result, error in
            print("🍎 [HushhAuth] signIn callback received")
            
            if let error = error {
                print("❌ [HushhAuth] Sign-in error: \(error.localizedDescription)")
                let nsError = error as NSError
                print("❌ [HushhAuth] Error code: \(nsError.code), domain: \(nsError.domain)")
                if nsError.code == GIDSignInError.canceled.rawValue {
                    call.reject("User cancelled sign-in", "USER_CANCELLED")
                } else {
                    call.reject("Sign-in failed: \(error.localizedDescription)")
                }
                return
            }
            
            guard let result = result else {
                print("❌ [HushhAuth] No sign-in result!")
                call.reject("No sign-in result")
                return
            }
            print("✅ [HushhAuth] Got sign-in result")
            
            let user = result.user
            print("🍎 [HushhAuth] User: \(user.profile?.email ?? "no email")")
            
            // Get ID token
            guard let idToken = user.idToken?.tokenString else {
                print("❌ [HushhAuth] No ID token!")
                call.reject("No ID token received from Google")
                return
            }
            print("✅ [HushhAuth] Got ID token: \(idToken.prefix(50))...")
            
            let accessToken = user.accessToken.tokenString
            print("✅ [HushhAuth] Got access token: \(accessToken.prefix(20))...")
            
            // Build user info
            let authUser = AuthUser(
                id: user.userID ?? "",
                email: user.profile?.email ?? "",
                displayName: user.profile?.name ?? "",
                photoUrl: user.profile?.imageURL(withDimension: 200)?.absoluteString ?? "",
                emailVerified: true
            )
            print("✅ [HushhAuth] Built authUser: \(authUser.email)")
            
            // Store locally
            self?.currentUser = authUser
            self?.currentIdToken = idToken
            self?.currentAccessToken = accessToken
            print("🍎 [HushhAuth] Stored credentials locally")
            
            // Save to Keychain for session persistence
            self?.saveCredentialsToKeychain(idToken: idToken, accessToken: accessToken, user: authUser)
            print("🍎 [HushhAuth] Saved to Keychain")
            
            print("🍎 [HushhAuth] About to call.resolve()...")
            
            // Return result
            let response: [String: Any] = [
                "idToken": idToken,
                "accessToken": accessToken,
                "user": [
                    "id": authUser.id,
                    "email": authUser.email,
                    "displayName": authUser.displayName,
                    "photoUrl": authUser.photoUrl,
                    "emailVerified": authUser.emailVerified
                ] as [String: Any]
            ]
            print("🍎 [HushhAuth] Response prepared, calling resolve now")
            call.resolve(response)
            print("✅ [HushhAuth] call.resolve() completed!")
        }
        print("🍎 [HushhAuth] signIn(withPresenting:) was called, waiting for user...")
    }
    
    // MARK: - Sign Out
    
    @objc func signOut(_ call: CAPPluginCall) {
        // Sign out from Google SDK
        GIDSignIn.sharedInstance.signOut()
        
        // Clear local state
        currentUser = nil
        currentIdToken = nil
        currentAccessToken = nil
        
        // Clear Keychain
        clearKeychainCredentials()
        
        print("🍎 [HushhAuth] Signed out")
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
        
        // Try to refresh from Google Sign-In SDK
        if let currentUser = GIDSignIn.sharedInstance.currentUser {
            currentUser.refreshTokensIfNeeded { user, error in
                if let error = error {
                    print("🍎 [HushhAuth] Token refresh failed: \(error)")
                    call.resolve(["idToken": NSNull()])
                    return
                }
                
                if let idToken = user?.idToken?.tokenString {
                    self.currentIdToken = idToken
                    call.resolve(["idToken": idToken])
                } else {
                    call.resolve(["idToken": NSNull()])
                }
            }
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
        
        // Try Google Sign-In SDK
        if let gidUser = GIDSignIn.sharedInstance.currentUser {
            let user = AuthUser(
                id: gidUser.userID ?? "",
                email: gidUser.profile?.email ?? "",
                displayName: gidUser.profile?.name ?? "",
                photoUrl: gidUser.profile?.imageURL(withDimension: 200)?.absoluteString ?? "",
                emailVerified: true
            )
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
        // Check Google Sign-In SDK first
        if GIDSignIn.sharedInstance.hasPreviousSignIn() {
            call.resolve(["signedIn": true])
            return
        }
        
        // Check local state
        if currentIdToken != nil {
            call.resolve(["signedIn": true])
            return
        }
        
        // Check Keychain
        if loadIdTokenFromKeychain() != nil {
            call.resolve(["signedIn": true])
            return
        }
        
        call.resolve(["signedIn": false])
    }
    
    // MARK: - Keychain Storage
    
    private let keychainService = "com.hushh.pda.auth"
    private let idTokenKey = "google_id_token"
    private let accessTokenKey = "google_access_token"
    private let userDataKey = "google_user_data"
    
    private func saveCredentialsToKeychain(idToken: String, accessToken: String, user: AuthUser) {
        saveToKeychain(key: idTokenKey, value: idToken)
        saveToKeychain(key: accessTokenKey, value: accessToken)
        
        // Save user as JSON
        if let userData = try? JSONEncoder().encode(user),
           let userString = String(data: userData, encoding: .utf8) {
            saveToKeychain(key: userDataKey, value: userString)
        }
    }
    
    private func loadIdTokenFromKeychain() -> String? {
        return loadFromKeychain(key: idTokenKey)
    }
    
    private func loadUserFromKeychain() -> AuthUser? {
        guard let userString = loadFromKeychain(key: userDataKey),
              let userData = userString.data(using: .utf8),
              let user = try? JSONDecoder().decode(AuthUser.self, from: userData) else {
            return nil
        }
        return user
    }
    
    private func clearKeychainCredentials() {
        deleteFromKeychain(key: idTokenKey)
        deleteFromKeychain(key: accessTokenKey)
        deleteFromKeychain(key: userDataKey)
    }
    
    private func saveToKeychain(key: String, value: String) {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    private func loadFromKeychain(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        if status == errSecSuccess,
           let data = result as? Data,
           let string = String(data: data, encoding: .utf8) {
            return string
        }
        return nil
    }
    
    private func deleteFromKeychain(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
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
