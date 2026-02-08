package com.hushh.app.plugins.HushhAccount

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * HushhAccountPlugin - Account Management
 * Port of iOS HushhAccountPlugin.swift
 *
 * Handles account-level operations like deletion.
 */
@CapacitorPlugin(name = "HushhAccount")
class HushhAccountPlugin : Plugin() {

    private val TAG = "HushhAccount"

    // Longer timeout for deletion operations
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(45, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .build()

    // Default backend URL
    private val defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"

    /**
     * Delete the user's account and all associated data.
     * Requires VAULT_OWNER token (Unlock to Delete).
     * This action is irreversible.
     */
    @PluginMethod
    fun deleteAccount(call: PluginCall) {
        val authToken = call.getString("authToken")
        if (authToken == null) {
            call.reject("Missing required parameter: authToken")
            return
        }

        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/api/account/delete"

        Log.w(TAG, "🚨 [HushhAccountPlugin] Requesting account deletion...")

        Thread {
            try {
                val request = Request.Builder()
                    .url(url)
                    .delete()
                    .addHeader("Authorization", "Bearer $authToken")
                    .build()

                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string()

                activity.runOnUiThread {
                    if (response.isSuccessful) {
                        Log.i(TAG, "✅ [HushhAccountPlugin] Account deleted successfully")
                        call.resolve(JSObject().apply {
                            put("success", true)
                        })
                    } else {
                        // Try to parse error message from response
                        val errorMessage = try {
                            responseBody?.let {
                                JSONObject(it).optString("detail", "Server returned ${response.code}")
                            } ?: "Server returned ${response.code}"
                        } catch (e: Exception) {
                            "Server returned ${response.code}"
                        }
                        Log.e(TAG, "❌ [HushhAccountPlugin] Deletion failed: $errorMessage")
                        call.reject(errorMessage)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [HushhAccountPlugin] Network error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Network error: ${e.message}")
                }
            }
        }.start()
    }
}
