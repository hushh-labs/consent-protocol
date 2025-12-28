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
import FirebaseAuth

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
            print("✅ [HushhAuth] Got Google sign-in result")
            
            let user = result.user
            print("🍎 [HushhAuth] Google User: \(user.profile?.email ?? "no email")")
            
            // Get ID token
            guard let idToken = user.idToken?.tokenString else {
                print("❌ [HushhAuth] No ID token!")
                call.reject("No ID token received from Google")
                return
            }
            
            let accessToken = user.accessToken.tokenString
            
            // ---------------------------------------------------------
            // NATIVE FIREBASE AUTHENTICATION
            // ---------------------------------------------------------
            print("🔥 [HushhAuth] Exchanging Google credential for Firebase credential...")
            
            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: accessToken
            )
            
            Auth.auth().signIn(with: credential) { authResult, error in
                if let error = error {
                    print("❌ [HushhAuth] Firebase native sign-in failed: \(error.localizedDescription)")
                    call.reject("Firebase sign-in failed: \(error.localizedDescription)")
                    return
                }
                
                guard let firebaseUser = authResult?.user else {
                    print("❌ [HushhAuth] No Firebase user returned!")
                    call.reject("No Firebase user returned")
                    return
                }
                
                print("✅ [HushhAuth] Firebase native sign-in success!")
                print("🔥 [HushhAuth] Firebase UID: \(firebaseUser.uid)")
                
                // Get Firebase ID Token
                firebaseUser.getIDToken { firebaseIdToken, error in
                    if let error = error {
                        print("❌ [HushhAuth] Failed to get Firebase ID token: \(error.localizedDescription)")
                        call.reject("Failed to get Firebase ID token: \(error.localizedDescription)")
                        return
                    }
                    
                    guard let firebaseIdToken = firebaseIdToken else {
                        print("❌ [HushhAuth] specific Firebase ID token is nil")
                        call.reject("Firebase ID token is nil")
                        return
                    }
                    
                    print("✅ [HushhAuth] Got Firebase ID token: \(firebaseIdToken.prefix(20))...")
                
                    // Build user info using FIREBASE UID
                    let authUser = AuthUser(
                        id: firebaseUser.uid,
                        email: firebaseUser.email ?? user.profile?.email ?? "",
                        displayName: firebaseUser.displayName ?? user.profile?.name ?? "",
                        photoUrl: firebaseUser.photoURL?.absoluteString ?? user.profile?.imageURL(withDimension: 200)?.absoluteString ?? "",
                        emailVerified: firebaseUser.isEmailVerified
                    )
                    
                    print("✅ [HushhAuth] Built authUser with Firebase UID: \(authUser.id)")
                    
                    // Store locally
                    self?.currentUser = authUser
                    self?.currentIdToken = firebaseIdToken // Store Firebase ID token!
                    self?.currentAccessToken = accessToken
                    
                    // Save to Keychain
                    self?.saveCredentialsToKeychain(idToken: firebaseIdToken, accessToken: accessToken, user: authUser)
                    
                    // Return result
                    let response: [String: Any] = [
                        "idToken": firebaseIdToken, // Return Firebase ID token!
                        "accessToken": accessToken,
                        "user": [
                            "id": authUser.id,
                            "email": authUser.email,
                            "displayName": authUser.displayName,
                            "photoUrl": authUser.photoUrl,
                            "emailVerified": authUser.emailVerified
                        ] as [String: Any]
                    ]
                    
                    call.resolve(response)
                    print("✅ [HushhAuth] call.resolve() completed with Firebase UID and Token")
                }
            }
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
