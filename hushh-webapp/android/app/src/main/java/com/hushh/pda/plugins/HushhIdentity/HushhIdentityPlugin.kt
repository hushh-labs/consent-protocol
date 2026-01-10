package com.hushh.pda.plugins.HushhIdentity

import android.util.Log
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * HushhIdentityPlugin - Investor Identity Resolution (Capacitor 8)
 *
 * Handles investor identity detection and confirmation for Kai onboarding.
 * Separate modular plugin following existing pattern.
 *
 * Methods:
 * - autoDetect: Detect investor from Firebase displayName
 * - searchInvestors: Search investor profiles by name
 * - getInvestor: Get full investor profile by ID
 * - confirmIdentity: Encrypt profile and save to vault
 * - getIdentityStatus: Check if user has confirmed identity
 * - resetIdentity: Delete confirmed identity
 */
@CapacitorPlugin(name = "HushhIdentity")
class HushhIdentityPlugin : Plugin() {

    private val TAG = "HushhIdentity"
    
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    // Default Cloud Run backend URL (fallback if not provided by JS layer)
    private val defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"

    // ==================== Auto Detect ====================
    /**
     * Auto-detect investor from Firebase displayName.
     * Sends Firebase ID token to backend which extracts displayName and searches investor_profiles.
     */
    @PluginMethod
    fun autoDetect(call: PluginCall) {
        val authToken = call.getString("authToken")
        
        if (authToken == null) {
            call.reject("Missing required parameter: authToken")
            return
        }
        
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/api/identity/auto-detect"
        
        Log.d(TAG, "🔍 [autoDetect] Auto-detecting investor...")
        
        Thread {
            try {
                val request = Request.Builder()
                    .url(url)
                    .get()
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $authToken")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string() ?: "{}"
                
                if (!response.isSuccessful) {
                    Log.e(TAG, "❌ [autoDetect] Backend error: $body")
                    activity.runOnUiThread {
                        call.reject("Auto-detect failed: HTTP ${response.code}")
                    }
                    return@Thread
                }
                
                val json = JSONObject(body)
                val result = jsonToJSObject(json)
                
                Log.d(TAG, "✅ [autoDetect] Response received")
                
                activity.runOnUiThread {
                    call.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [autoDetect] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Auto-detect failed: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Search Investors ====================
    /**
     * Search investor profiles by name (public endpoint, no auth required).
     */
    @PluginMethod
    fun searchInvestors(call: PluginCall) {
        val name = call.getString("name")
        
        if (name == null) {
            call.reject("Missing required parameter: name")
            return
        }
        
        val limit = call.getInt("limit") ?: 10
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val encodedName = java.net.URLEncoder.encode(name, "UTF-8")
        val url = "$backendUrl/api/investors/search?name=$encodedName&limit=$limit"
        
        Log.d(TAG, "🔍 [searchInvestors] Searching for: $name")
        
        Thread {
            try {
                val request = Request.Builder()
                    .url(url)
                    .get()
                    .addHeader("Content-Type", "application/json")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string() ?: "[]"
                
                if (!response.isSuccessful) {
                    Log.e(TAG, "❌ [searchInvestors] Backend error: $body")
                    activity.runOnUiThread {
                        call.reject("Search failed: HTTP ${response.code}")
                    }
                    return@Thread
                }
                
                val jsonArray = JSONArray(body)
                val jsArray = JSArray()
                for (i in 0 until jsonArray.length()) {
                    jsArray.put(jsonToJSObject(jsonArray.getJSONObject(i)))
                }
                
                Log.d(TAG, "✅ [searchInvestors] Found ${jsonArray.length()} investors")
                
                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("investors", jsArray)
                    })
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [searchInvestors] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Search failed: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Get Investor ====================
    /**
     * Get full investor profile by ID (public endpoint, no auth required).
     */
    @PluginMethod
    fun getInvestor(call: PluginCall) {
        val investorId = call.getInt("id")
        
        if (investorId == null) {
            call.reject("Missing required parameter: id")
            return
        }
        
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/api/investors/$investorId"
        
        Log.d(TAG, "📈 [getInvestor] Getting investor $investorId")
        
        Thread {
            try {
                val request = Request.Builder()
                    .url(url)
                    .get()
                    .addHeader("Content-Type", "application/json")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string() ?: "{}"
                
                if (!response.isSuccessful) {
                    Log.e(TAG, "❌ [getInvestor] Backend error: $body")
                    activity.runOnUiThread {
                        if (response.code == 404) {
                            call.reject("Investor not found")
                        } else {
                            call.reject("Get investor failed: HTTP ${response.code}")
                        }
                    }
                    return@Thread
                }
                
                val json = JSONObject(body)
                val result = jsonToJSObject(json)
                
                Log.d(TAG, "✅ [getInvestor] Got investor profile")
                
                activity.runOnUiThread {
                    call.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [getInvestor] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Get investor failed: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Confirm Identity ====================
    /**
     * Confirm identity and save encrypted profile to vault.
     * Requires VAULT_OWNER token.
     */
    @PluginMethod
    fun confirmIdentity(call: PluginCall) {
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        val investorId = call.getInt("investorId")
        val profileDataCiphertext = call.getString("profileDataCiphertext")
        val profileDataIv = call.getString("profileDataIv")
        val profileDataTag = call.getString("profileDataTag")
        
        if (vaultOwnerToken == null || investorId == null || 
            profileDataCiphertext == null || profileDataIv == null || profileDataTag == null) {
            call.reject("Missing required parameters")
            return
        }
        
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/api/identity/confirm"
        
        Log.d(TAG, "✅ [confirmIdentity] Confirming identity for investor $investorId")
        
        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("investor_id", investorId)
                    put("profile_data_ciphertext", profileDataCiphertext)
                    put("profile_data_iv", profileDataIv)
                    put("profile_data_tag", profileDataTag)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val request = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $vaultOwnerToken")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string() ?: "{}"
                
                val json = JSONObject(body)
                
                if (!response.isSuccessful) {
                    val detail = json.optString("detail", "Unknown error")
                    Log.e(TAG, "❌ [confirmIdentity] Backend error: $detail")
                    activity.runOnUiThread {
                        call.reject(detail)
                    }
                    return@Thread
                }
                
                val result = jsonToJSObject(json)
                
                Log.d(TAG, "✅ [confirmIdentity] Identity confirmed!")
                
                activity.runOnUiThread {
                    call.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [confirmIdentity] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Confirm failed: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Get Identity Status ====================
    /**
     * Check if user has confirmed an identity.
     * Requires VAULT_OWNER token.
     */
    @PluginMethod
    fun getIdentityStatus(call: PluginCall) {
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        
        if (vaultOwnerToken == null) {
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/api/identity/status"
        
        Log.d(TAG, "📋 [getIdentityStatus] Getting identity status")
        
        Thread {
            try {
                val request = Request.Builder()
                    .url(url)
                    .get()
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $vaultOwnerToken")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string() ?: "{}"
                
                if (!response.isSuccessful) {
                    Log.e(TAG, "❌ [getIdentityStatus] Backend error: $body")
                    activity.runOnUiThread {
                        call.reject("Get status failed: HTTP ${response.code}")
                    }
                    return@Thread
                }
                
                val json = JSONObject(body)
                val result = jsonToJSObject(json)
                
                Log.d(TAG, "✅ [getIdentityStatus] Got identity status")
                
                activity.runOnUiThread {
                    call.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [getIdentityStatus] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Get status failed: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Reset Identity ====================
    /**
     * Delete user's confirmed identity.
     * Requires VAULT_OWNER token.
     */
    @PluginMethod
    fun resetIdentity(call: PluginCall) {
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        
        if (vaultOwnerToken == null) {
            call.reject("Missing required parameter: vaultOwnerToken")
            return
        }
        
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/api/identity/profile"
        
        Log.d(TAG, "🗑️ [resetIdentity] Resetting identity")
        
        Thread {
            try {
                val request = Request.Builder()
                    .url(url)
                    .delete()
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $vaultOwnerToken")
                    .build()
                
                val response = httpClient.newCall(request).execute()
                
                Log.d(TAG, "✅ [resetIdentity] Identity reset")
                
                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("success", true)
                    })
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [resetIdentity] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Reset failed: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Helpers ====================
    
    /**
     * Convert JSONObject to JSObject for Capacitor.
     */
    private fun jsonToJSObject(json: JSONObject): JSObject {
        val result = JSObject()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val value = json.get(key)
            when (value) {
                is JSONObject -> result.put(key, jsonToJSObject(value))
                is JSONArray -> {
                    val jsArray = JSArray()
                    for (i in 0 until value.length()) {
                        val item = value.get(i)
                        when (item) {
                            is JSONObject -> jsArray.put(jsonToJSObject(item))
                            else -> jsArray.put(item)
                        }
                    }
                    result.put(key, jsArray)
                }
                else -> result.put(key, value)
            }
        }
        return result
    }
}
