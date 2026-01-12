package com.hushh.app

import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import com.hushh.app.plugins.HushhAuth.HushhAuthPlugin
import com.hushh.app.plugins.HushhConsent.HushhConsentPlugin
import com.hushh.app.plugins.HushhIdentity.HushhIdentityPlugin
import com.hushh.app.plugins.HushhVault.HushhVaultPlugin
import com.hushh.app.plugins.HushhKeystore.HushhKeystorePlugin
import com.hushh.app.plugins.HushhSettings.HushhSettingsPlugin
import com.hushh.app.plugins.HushhSync.HushhSyncPlugin
import com.hushh.app.plugins.Kai.KaiPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d("MainActivity", "🔌 [MainActivity] Registering all native plugins...")
        
        // Register all Hushh native plugins
        registerPlugin(HushhAuthPlugin::class.java)
        registerPlugin(HushhVaultPlugin::class.java) // Reordered as per instruction
        registerPlugin(HushhConsentPlugin::class.java) // Reordered as per instruction
        registerPlugin(HushhIdentityPlugin::class.java) // Investor identity (Kai Preferences)
        registerPlugin(HushhSyncPlugin::class.java) // Reordered as per instruction
        registerPlugin(HushhSettingsPlugin::class.java) // Reordered as per instruction
        registerPlugin(HushhKeystorePlugin::class.java) // Reordered as per instruction
        registerPlugin(KaiPlugin::class.java) // Agent Kai plugin
        
        Log.d("MainActivity", "✅ [MainActivity] All 8 plugins registered successfully") // Updated count
        
        super.onCreate(savedInstanceState)
    }
}
