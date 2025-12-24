//
//  HushhAuthPlugin.m
//  App
//
//  Objective-C bridge for HushhAuthPlugin
//  Required for Capacitor to discover the Swift plugin
//

#import <Capacitor/Capacitor.h>
#import <Foundation/Foundation.h>

CAP_PLUGIN(HushhAuthPlugin, "HushhAuth",
           CAP_PLUGIN_METHOD(signIn, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(signOut, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getIdToken, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getCurrentUser, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isSignedIn, CAPPluginReturnPromise);)
