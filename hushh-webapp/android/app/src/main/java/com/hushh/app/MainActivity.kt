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
import com.hushh.app.plugins.HushhOnboarding.HushhOnboardingPlugin
import com.hushh.app.plugins.Kai.KaiPlugin
import com.hushh.app.plugins.WorldModel.WorldModelPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        Log.d("MainActivity", "🔌 [MainActivity] Registering all native plugins...")
        
        // Register all Hushh native plugins
        registerPlugin(HushhAuthPlugin::class.java)
        registerPlugin(HushhVaultPlugin::class.java)
        registerPlugin(HushhConsentPlugin::class.java)
        registerPlugin(HushhIdentityPlugin::class.java) // Investor identity (Kai Preferences)
        registerPlugin(HushhSyncPlugin::class.java)
        registerPlugin(HushhOnboardingPlugin::class.java)
        registerPlugin(HushhSettingsPlugin::class.java)
        registerPlugin(HushhKeystorePlugin::class.java)
        registerPlugin(KaiPlugin::class.java) // Agent Kai plugin
        registerPlugin(WorldModelPlugin::class.java) // World Model plugin
        
        Log.d("MainActivity", "✅ [MainActivity] All 10 plugins registered successfully")
        
        super.onCreate(savedInstanceState)
    }
}
