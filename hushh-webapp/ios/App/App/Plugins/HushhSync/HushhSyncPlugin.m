//
//  HushhSyncPlugin.m
//  App
//
//  Objective-C bridge for HushhSyncPlugin
//

#import <Capacitor/Capacitor.h>
#import <Foundation/Foundation.h>

CAP_PLUGIN(HushhSyncPlugin, "HushhSync",
           CAP_PLUGIN_METHOD(sync, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(push, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(pull, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(syncVault, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getSyncStatus, CAPPluginReturnPromise);)
