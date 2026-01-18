import UIKit
import Capacitor
import FirebaseCore
import FirebaseAuth
import GoogleSignIn
import AuthenticationServices
import CryptoKit

/**
 * HushhAuthPlugin - Native iOS Authentication (Capacitor 8)
 *
 * Supports both Google Sign-In and Sign in with Apple.
 * Uses CAPBridgedPlugin protocol with pluginMethods array.
 * No .m bridging file needed.
 */
@objc(HushhAuthPlugin)
public class HushhAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // MARK: - CAPBridgedPlugin Protocol
    public let identifier = "HushhAuthPlugin"
    public let jsName = "HushhAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getIdToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentUser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSignedIn", returnType: CAPPluginReturnPromise)
    ]
    
    // MARK: - Properties
    private let TAG = "HushhAuth"
    private var currentIdToken: String?
    private var currentAccessToken: String?
    
    // Apple Sign-In properties
    private var currentNonce: String?
    private var appleSignInCall: CAPPluginCall?
    
    // MARK: - Sign In
    @objc func signIn(_ call: CAPPluginCall) {
        print("🤖 [\(TAG)] signIn() CALLED - Native plugin invoked!")
        
        guard let viewController = bridge?.viewController else {
            call.reject("No view controller available")
            return
        }
        
        // Get Web Client ID from GoogleService-Info.plist
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path),
              let clientId = plist["CLIENT_ID"] as? String else {
            call.reject("Missing GoogleService-Info.plist or CLIENT_ID")
            return
        }
        
        let config = GIDConfiguration(clientID: clientId)
        GIDSignIn.sharedInstance.configuration = config
        
        GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { [weak self] result, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Google Sign-In failed: \(error.localizedDescription)")
                call.reject("Sign-in failed: \(error.localizedDescription)")
                return
            }
            
            guard let user = result?.user,
                  let idToken = user.idToken?.tokenString else {
                call.reject("No ID token received from Google")
                return
            }
            
            let accessToken = user.accessToken.tokenString
            print("✅ [\(self.TAG)] Got Google account: \(user.profile?.email ?? "unknown")")
            
            // Exchange for Firebase credential
            let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: accessToken)
            
            Auth.auth().signIn(with: credential) { authResult, error in
                if let error = error {
                    print("❌ [\(self.TAG)] Firebase sign-in failed: \(error.localizedDescription)")
                    call.reject("Firebase sign-in failed: \(error.localizedDescription)")
                    return
                }
                
                guard let firebaseUser = authResult?.user else {
                    call.reject("No Firebase user returned")
                    return
                }
                
                print("✅ [\(self.TAG)] Firebase sign-in success! UID: \(firebaseUser.uid)")
                
                // Get Firebase ID token
                firebaseUser.getIDToken { firebaseIdToken, error in
                    if let error = error {
                        call.reject("Failed to get Firebase ID token: \(error.localizedDescription)")
                        return
                    }
                    
                    self.currentIdToken = firebaseIdToken
                    self.currentAccessToken = idToken
                    
                    // Store in UserDefaults (TODO: migrate to Keychain)
                    UserDefaults.standard.set(firebaseIdToken, forKey: "hushh_id_token")
                    UserDefaults.standard.set(idToken, forKey: "hushh_access_token")
                    
                    let response: [String: Any] = [
                        "idToken": firebaseIdToken ?? "",
                        "accessToken": idToken,
                        "user": [
                "uid": firebaseUser.uid,
                            "email": firebaseUser.email ?? "",
                            "displayName": firebaseUser.displayName ?? "",
                            "photoUrl": firebaseUser.photoURL?.absoluteString ?? "",
                            "emailVerified": firebaseUser.isEmailVerified
                        ]
                    ]
                    
                    print("✅ [\(self.TAG)] call.resolve() completed with Firebase UID and Token")
                    call.resolve(response)
                }
            }
        }
    }
    
    // MARK: - Sign Out
    @objc func signOut(_ call: CAPPluginCall) {
        print("🤖 [\(TAG)] signOut() called")
        
        // Sign out from Firebase
        do {
            try Auth.auth().signOut()
        } catch {
            print("⚠️ [\(TAG)] Firebase sign out error: \(error.localizedDescription)")
        }
        
        // Sign out from Google
        GIDSignIn.sharedInstance.signOut()
        
        // Clear local state
        currentIdToken = nil
        currentAccessToken = nil
        UserDefaults.standard.removeObject(forKey: "hushh_id_token")
        UserDefaults.standard.removeObject(forKey: "hushh_access_token")
        UserDefaults.standard.removeObject(forKey: "hushh_user_id")
        UserDefaults.standard.removeObject(forKey: "hushh_user_email")
        
        print("✅ [\(TAG)] Signed out")
        call.resolve()
    }
    
    // MARK: - Get ID Token
    @objc func getIdToken(_ call: CAPPluginCall) {
        if let user = Auth.auth().currentUser {
            // Get fresh token from Firebase
            user.getIDToken { [weak self] token, error in
                guard let self = self else { return }
                
                if let token = token {
                    self.currentIdToken = token
                    UserDefaults.standard.set(token, forKey: "hushh_id_token")
                    call.resolve(["idToken": token])
                } else if let cached = self.currentIdToken ?? UserDefaults.standard.string(forKey: "hushh_id_token") {
                    call.resolve(["idToken": cached])
                } else {
                    call.resolve(["idToken": NSNull()])
                }
            }
        } else if let cached = currentIdToken ?? UserDefaults.standard.string(forKey: "hushh_id_token") {
            call.resolve(["idToken": cached])
        } else {
            call.resolve(["idToken": NSNull()])
        }
    }
    
    // MARK: - Get Current User
    @objc func getCurrentUser(_ call: CAPPluginCall) {
        if let user = Auth.auth().currentUser {
            let userData: [String: Any] = [
                "uid": user.uid,
                "email": user.email ?? "",
                "displayName": user.displayName ?? "",
                "photoUrl": user.photoURL?.absoluteString ?? "",
                "emailVerified": user.isEmailVerified
            ]
            call.resolve(["user": userData])
        } else {
            call.resolve(["user": NSNull()])
        }
    }
    
    // MARK: - Is Signed In
    @objc func isSignedIn(_ call: CAPPluginCall) {
        let signedIn = Auth.auth().currentUser != nil
        call.resolve(["signedIn": signedIn])
    }
    
    // MARK: - Apple Sign In
    @objc func signInWithApple(_ call: CAPPluginCall) {
        print("🍎 [\(TAG)] signInWithApple() CALLED - Native plugin invoked!")
        
        appleSignInCall = call
        
        // Generate nonce for security
        let nonce = randomNonceString()
        currentNonce = nonce
        
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }
    
    // MARK: - Nonce Helpers
    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        var randomBytes = [UInt8](repeating: 0, count: length)
        let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        if errorCode != errSecSuccess {
            fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
        }
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        let nonce = randomBytes.map { byte in
            charset[Int(byte) % charset.count]
        }
        return String(nonce)
    }
    
    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        let hashString = hashedData.compactMap {
            String(format: "%02x", $0)
        }.joined()
        return hashString
    }
}

// MARK: - ASAuthorizationControllerDelegate
extension HushhAuthPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            appleSignInCall?.reject("Invalid Apple credential type")
            appleSignInCall = nil
            return
        }
        
        guard let appleIDToken = appleIDCredential.identityToken,
              let idTokenString = String(data: appleIDToken, encoding: .utf8) else {
            appleSignInCall?.reject("Unable to fetch identity token")
            appleSignInCall = nil
            return
        }
        
        guard let nonce = currentNonce else {
            appleSignInCall?.reject("Invalid state: A login callback was received, but no login request was sent.")
            appleSignInCall = nil
            return
        }
        
        print("✅ [\(TAG)] Got Apple credential for: \(appleIDCredential.email ?? "(hidden email)")")
        
        // Exchange for Firebase credential
        let credential = OAuthProvider.credential(
            withProviderID: "apple.com",
            idToken: idTokenString,
            rawNonce: nonce
        )
        
        Auth.auth().signIn(with: credential) { [weak self] authResult, error in
            guard let self = self else { return }
            
            if let error = error {
                print("❌ [\(self.TAG)] Firebase sign-in failed: \(error.localizedDescription)")
                self.appleSignInCall?.reject("Firebase sign-in failed: \(error.localizedDescription)")
                self.appleSignInCall = nil
                return
            }
            
            guard let firebaseUser = authResult?.user else {
                self.appleSignInCall?.reject("No Firebase user returned")
                self.appleSignInCall = nil
                return
            }
            
            print("✅ [\(self.TAG)] Firebase Apple sign-in success! UID: \(firebaseUser.uid)")
            
            // Get Firebase ID token
            firebaseUser.getIDToken { firebaseIdToken, error in
                if let error = error {
                    self.appleSignInCall?.reject("Failed to get Firebase ID token: \(error.localizedDescription)")
                    self.appleSignInCall = nil
                    return
                }
                
                // Build display name from Apple credential (only available on first sign-in)
                var displayName = firebaseUser.displayName ?? ""
                if displayName.isEmpty, let fullName = appleIDCredential.fullName {
                    let givenName = fullName.givenName ?? ""
                    let familyName = fullName.familyName ?? ""
                    displayName = [givenName, familyName]
                        .filter { !$0.isEmpty }
                        .joined(separator: " ")
                }
                
                self.currentIdToken = firebaseIdToken
                
                // Store in UserDefaults
                UserDefaults.standard.set(firebaseIdToken, forKey: "hushh_id_token")
                
                let response: [String: Any] = [
                    "idToken": firebaseIdToken ?? "",
                    "rawNonce": nonce,  // Needed for JS SDK sync if required
                    "user": [
                        "uid": firebaseUser.uid,
                        "email": firebaseUser.email ?? appleIDCredential.email ?? "",
                        "displayName": displayName,
                        "photoUrl": firebaseUser.photoURL?.absoluteString ?? "",
                        "emailVerified": firebaseUser.isEmailVerified
                    ]
                ]
                
                print("✅ [\(self.TAG)] Apple sign-in call.resolve() completed with Firebase UID and Token")
                self.appleSignInCall?.resolve(response)
                self.appleSignInCall = nil
            }
        }
    }
    
    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithError error: Error) {
        print("❌ [\(TAG)] Apple Sign-In failed: \(error.localizedDescription)")
        
        // Check for user cancellation
        if let authError = error as? ASAuthorizationError {
            switch authError.code {
            case .canceled:
                appleSignInCall?.reject("User cancelled Apple Sign-In", "USER_CANCELLED")
            case .failed:
                appleSignInCall?.reject("Apple Sign-In failed: \(error.localizedDescription)")
            case .invalidResponse:
                appleSignInCall?.reject("Invalid response from Apple Sign-In")
            case .notHandled:
                appleSignInCall?.reject("Apple Sign-In request not handled")
            case .unknown:
                appleSignInCall?.reject("Unknown Apple Sign-In error: \(error.localizedDescription)")
            @unknown default:
                appleSignInCall?.reject("Apple Sign-In error: \(error.localizedDescription)")
            }
        } else {
            appleSignInCall?.reject("Apple Sign-In failed: \(error.localizedDescription)")
        }
        appleSignInCall = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding
extension HushhAuthPlugin: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? UIWindow()
    }
}
