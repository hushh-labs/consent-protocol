//
//  HushhSettingsPlugin.swift
//  App
//
//  Capacitor plugin for settings management.
//

import Foundation
import Capacitor

@objc(HushhSettingsPlugin)
public class HushhSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    
    public let identifier = "HushhSettingsPlugin"
    public let jsName = "HushhSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shouldUseLocalAgents", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shouldSyncToCloud", returnType: CAPPluginReturnPromise)
    ]
    
    @objc func getSettings(_ call: CAPPluginCall) {
        let settings = SettingsManager.shared.getSettings()
        
        call.resolve([
            "useRemoteSync": settings.useRemoteSync,
            "syncOnWifiOnly": settings.syncOnWifiOnly,
            "useRemoteLLM": settings.useRemoteLLM,
            "preferredLLMProvider": settings.preferredLLMProvider.rawValue,
            "requireBiometricUnlock": settings.requireBiometricUnlock,
            "autoLockTimeout": settings.autoLockTimeout,
            "theme": settings.theme.rawValue,
            "hapticFeedback": settings.hapticFeedback,
            "showDebugInfo": settings.showDebugInfo,
            "verboseLogging": settings.verboseLogging
        ])
    }
    
    @objc func updateSettings(_ call: CAPPluginCall) {
        SettingsManager.shared.updateSettings { settings in
            if let v = call.getBool("useRemoteSync") { settings.useRemoteSync = v }
            if let v = call.getBool("syncOnWifiOnly") { settings.syncOnWifiOnly = v }
            if let v = call.getBool("useRemoteLLM") { settings.useRemoteLLM = v }
            if let s = call.getString("preferredLLMProvider"),
               let p = HushhSettings.LLMProvider(rawValue: s) { settings.preferredLLMProvider = p }
            if let v = call.getBool("requireBiometricUnlock") { settings.requireBiometricUnlock = v }
            if let v = call.getInt("autoLockTimeout") { settings.autoLockTimeout = v }
            if let s = call.getString("theme"),
               let t = HushhSettings.Theme(rawValue: s) { settings.theme = t }
            if let v = call.getBool("hapticFeedback") { settings.hapticFeedback = v }
            if let v = call.getBool("showDebugInfo") { settings.showDebugInfo = v }
            if let v = call.getBool("verboseLogging") { settings.verboseLogging = v }
        }
        call.resolve(["success": true])
    }
    
    @objc func resetSettings(_ call: CAPPluginCall) {
        SettingsManager.shared.resetToDefaults()
        call.resolve(["success": true])
    }
    
    @objc func shouldUseLocalAgents(_ call: CAPPluginCall) {
        call.resolve(["value": SettingsManager.shared.shouldUseLocalAgents])
    }
    
    @objc func shouldSyncToCloud(_ call: CAPPluginCall) {
        call.resolve(["value": SettingsManager.shared.shouldSyncToCloud])
    }
}
