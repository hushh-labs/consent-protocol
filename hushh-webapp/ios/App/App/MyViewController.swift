import UIKit
import Capacitor

/**
 * MyViewController - Custom Capacitor Bridge View Controller
 * 
 * This is the iOS equivalent of Android's MainActivity.kt
 * Registers all 10 native Hushh plugins with the Capacitor bridge.
 *
 * Following Capacitor 8 documentation:
 * https://capacitorjs.com/docs/ios/custom-code#register-the-plugin
 */
class MyViewController: CAPBridgeViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Disable bounce effect for stable scrolling (fixes iOS layout bounce)
        if let webView = self.webView {
            webView.scrollView.bounces = false
            webView.scrollView.alwaysBounceVertical = false
            webView.scrollView.alwaysBounceHorizontal = false
            webView.scrollView.contentInsetAdjustmentBehavior = .automatic
            print("🔧 [MyViewController] WebView bounce disabled for stable scrolling")
        }
    }
    
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        
        print("🔌 [MyViewController] Registering all native plugins...")
        print("🔌 [MyViewController] Bridge available: \(bridge != nil)")
        
        // Register all Hushh native plugins
        // These must match the jsName in each plugin's CAPBridgedPlugin protocol
        bridge?.registerPluginInstance(HushhAuthPlugin())
        bridge?.registerPluginInstance(HushhVaultPlugin())
        bridge?.registerPluginInstance(HushhConsentPlugin())
        bridge?.registerPluginInstance(HushhIdentityPlugin())
        bridge?.registerPluginInstance(KaiPlugin())
        bridge?.registerPluginInstance(HushhSyncPlugin())
        bridge?.registerPluginInstance(HushhSettingsPlugin())
        bridge?.registerPluginInstance(HushhKeystorePlugin())
        bridge?.registerPluginInstance(WorldModelPlugin())
        bridge?.registerPluginInstance(HushhOnboardingPlugin())
        
        print("✅ [MyViewController] All 10 plugins registered successfully:")
        print("   - HushhAuth (Google Sign-In)")
        print("   - HushhVault (Encryption + Cloud DB)")
        print("   - HushhConsent (Token Management)")
        print("   - HushhIdentity (Investor Identity)")
        print("   - Kai (Agent Kai)")
        print("   - HushhSync (Cloud Sync)")
        print("   - HushhSettings (App Settings)")
        print("   - HushhKeystore (Secure Storage)")
        print("   - WorldModel (World Model / Domain Data)")
        print("   - HushhOnboarding (Onboarding Tour Status)")
        
        // Verify plugins are actually accessible by the bridge
        verifyPluginRegistration()
    }
    
    /// Debug helper to verify plugins are properly registered and accessible
    private func verifyPluginRegistration() {
        print("🔍 [MyViewController] Verifying plugin registration...")
        
        let pluginNames = [
            "HushhAuth",
            "HushhVault", 
            "HushhConsent",
            "HushhIdentity",
            "Kai",
            "HushhSync",
            "HushhSettings",
            "HushhKeychain",  // Note: jsName is HushhKeychain (not HushhKeystore)
            "WorldModel",
            "HushhOnboarding"
        ]
        
        for name in pluginNames {
            if let plugin = bridge?.plugin(withName: name) {
                print("   ✅ \(name) found: \(type(of: plugin))")
            } else {
                print("   ❌ \(name) NOT FOUND!")
            }
        }
    }
}
