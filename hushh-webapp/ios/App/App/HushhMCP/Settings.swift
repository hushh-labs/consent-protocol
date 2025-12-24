//
//  Settings.swift
//  HushhMCP
//
//  Hushh Consent Protocol - Settings Management
//  Manages local-first vs remote operation preferences.
//
//  NOTE: During development, defaults are set to REMOTE.
//  For production, flip to LOCAL-first.
//

import Foundation

// MARK: - Settings

/// User preferences for local vs remote operation.
/// DEVELOPMENT DEFAULTS: Remote enabled for parity with web.
/// PRODUCTION DEFAULTS: Will flip to local-first.
public struct HushhSettings: Codable, Equatable {
    // Data Storage Mode
    public var useRemoteSync: Bool = true        // DEV: true, PROD: false
    public var syncOnWifiOnly: Bool = true
    
    // LLM Processing Mode
    public var useRemoteLLM: Bool = true         // DEV: true, PROD: false
    public var preferredLLMProvider: LLMProvider = .openai // Use cloud LLM for dev
    
    // Security
    public var requireBiometricUnlock: Bool = true
    public var autoLockTimeout: Int = 5          // Minutes
    
    // UI
    public var theme: Theme = .system
    public var hapticFeedback: Bool = true
    
    // Debug
    public var showDebugInfo: Bool = true        // DEV: true
    public var verboseLogging: Bool = true       // DEV: true
    
    public enum LLMProvider: String, Codable {
        case local   // On-device agents (no LLM)
        case mlx     // On-device MLX (future)
        case openai
        case anthropic
        case google
    }
    
    public enum Theme: String, Codable {
        case system
        case light
        case dark
    }
    
    public init() {}
}

// MARK: - Settings Manager

/// Manages user settings with UserDefaults persistence.
public class SettingsManager {
    
    public static let shared = SettingsManager()
    
    private let storageKey = "hushh_settings"
    private let defaults = UserDefaults.standard
    
    private var cachedSettings: HushhSettings?
    
    private init() {}
    
    // MARK: - Get Settings
    
    public func getSettings() -> HushhSettings {
        if let cached = cachedSettings {
            return cached
        }
        
        guard let data = defaults.data(forKey: storageKey),
              let settings = try? JSONDecoder().decode(HushhSettings.self, from: data) else {
            let defaultSettings = HushhSettings()
            cachedSettings = defaultSettings
            return defaultSettings
        }
        
        cachedSettings = settings
        return settings
    }
    
    // MARK: - Update Settings
    
    public func updateSettings(_ updates: (inout HushhSettings) -> Void) {
        var settings = getSettings()
        updates(&settings)
        saveSettings(settings)
    }
    
    public func saveSettings(_ settings: HushhSettings) {
        guard let data = try? JSONEncoder().encode(settings) else {
            print("[SettingsManager] Failed to encode settings")
            return
        }
        
        defaults.set(data, forKey: storageKey)
        cachedSettings = settings
        
        // Post notification for observers
        NotificationCenter.default.post(
            name: .hushhSettingsChanged,
            object: nil,
            userInfo: ["settings": settings]
        )
    }
    
    // MARK: - Reset
    
    public func resetToDefaults() {
        let defaultSettings = HushhSettings()
        saveSettings(defaultSettings)
    }
    
    // MARK: - Convenience
    
    /// Should use local agents (DEV default: false - use remote)
    public var shouldUseLocalAgents: Bool {
        return !getSettings().useRemoteLLM
    }
    
    /// Should sync to cloud (DEV default: true)
    public var shouldSyncToCloud: Bool {
        return getSettings().useRemoteSync
    }
    
    /// Get current LLM provider
    public var llmProvider: HushhSettings.LLMProvider {
        let settings = getSettings()
        return settings.useRemoteLLM ? settings.preferredLLMProvider : .local
    }
}

// MARK: - Notification

extension Notification.Name {
    public static let hushhSettingsChanged = Notification.Name("hushhSettingsChanged")
}
