//
//  HushhSettingsPlugin.m
//  App
//

#import <Capacitor/Capacitor.h>

CAP_PLUGIN(HushhSettingsPlugin, "HushhSettings",
           CAP_PLUGIN_METHOD(getSettings, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(updateSettings, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(resetSettings, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(shouldUseLocalAgents, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(shouldSyncToCloud, CAPPluginReturnPromise);)
