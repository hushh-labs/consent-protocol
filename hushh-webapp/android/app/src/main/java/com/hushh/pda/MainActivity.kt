package com.hushh.pda

import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import com.hushh.pda.plugins.HushhAuth.HushhAuthPlugin
import com.hushh.pda.plugins.HushhConsent.HushhConsentPlugin
import com.hushh.pda.plugins.HushhVault.HushhVaultPlugin
import com.hushh.pda.plugins.HushhKeystore.HushhKeystorePlugin
import com.hushh.pda.plugins.HushhSettings.HushhSettingsPlugin
import com.hushh.pda.plugins.HushhSync.HushhSyncPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d("MainActivity", "🔌 [MainActivity] Registering all native plugins...")
        
        // Register all Hushh native plugins
        registerPlugin(HushhAuthPlugin::class.java)
        registerPlugin(HushhConsentPlugin::class.java)
        registerPlugin(HushhVaultPlugin::class.java)
        registerPlugin(HushhKeystorePlugin::class.java)
        registerPlugin(HushhSettingsPlugin::class.java)
        registerPlugin(HushhSyncPlugin::class.java)
        
        Log.d("MainActivity", "✅ [MainActivity] All 6 plugins registered successfully")
        
        super.onCreate(savedInstanceState)
    }
}
