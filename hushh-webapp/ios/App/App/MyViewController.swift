import UIKit
import Capacitor

/**
 * MyViewController - Custom Capacitor Bridge View Controller
 * 
 * This is the iOS equivalent of Android's MainActivity.kt
 * Registers all 6 native Hushh plugins with the Capacitor bridge.
 *
 * Following Capacitor 8 documentation:
 * https://capacitorjs.com/docs/ios/custom-code#register-the-plugin
 */
class MyViewController: CAPBridgeViewController {
    
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        
        print("🔌 [MyViewController] Registering all native plugins...")
        
        // Register all Hushh native plugins
        // These must match the jsName in each plugin's CAPBridgedPlugin protocol
        bridge?.registerPluginInstance(HushhAuthPlugin())
        bridge?.registerPluginInstance(HushhVaultPlugin())
        bridge?.registerPluginInstance(HushhConsentPlugin())
        bridge?.registerPluginInstance(HushhSyncPlugin())
        bridge?.registerPluginInstance(HushhSettingsPlugin())
        bridge?.registerPluginInstance(HushhKeystorePlugin())
        
        print("✅ [MyViewController] All 6 plugins registered successfully:")
        print("   - HushhAuth (Google Sign-In)")
        print("   - HushhVault (Encryption + Cloud DB)")
        print("   - HushhConsent (Token Management)")
        print("   - HushhSync (Cloud Sync)")
        print("   - HushhSettings (App Settings)")
        print("   - HushhKeychain (Secure Storage)")
    }
}
