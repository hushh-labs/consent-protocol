//
//  MyViewController.swift
//  App
//
//  Custom ViewController that subclasses CAPBridgeViewController
//  Required for registering local Capacitor plugins
//

import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {
    
    override open func capacitorDidLoad() {
        // Register all local native plugins with Capacitor bridge
        NSLog("🔌 [MyViewController] Registering all native plugins...")
        
        bridge?.registerPluginInstance(HushhAuthPlugin())
        bridge?.registerPluginInstance(HushhVaultPlugin())
        bridge?.registerPluginInstance(HushhConsentPlugin())
        bridge?.registerPluginInstance(HushhKeychainPlugin())
        bridge?.registerPluginInstance(HushhSettingsPlugin())
        bridge?.registerPluginInstance(HushhSyncPlugin())
        
        NSLog("✅ [MyViewController] All 6 plugins registered successfully")
    }
}
