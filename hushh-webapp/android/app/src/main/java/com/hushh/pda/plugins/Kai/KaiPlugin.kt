package com.hushh.pda.plugins.Kai

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.json.JSONArray
import java.io.IOException

/**
 * Kai Plugin - Android Implementation
 * 
 * Native plugin for Agent Kai stock analysis.
 * Makes HTTP calls to backend from native code.
 */

@CapacitorPlugin(name = "Kai")
class KaiPlugin : Plugin() {
    
    private fun getBackendUrl(): String {
        // Read from environment/config, default to localhost
        val backendUrl = bridge.config.getString("backendUrl") 
            ?: System.getenv("NEXT_PUBLIC_BACKEND_URL")
            ?: "http://localhost:8000"
        
        // Android emulator: convert localhost to 10.0.2.2
        return if (backendUrl.contains("localhost")) {
            backendUrl.replace("localhost", "10.0.2.2")
        } else {
            backendUrl
        }
    }
    
    @PluginMethod
    fun grantConsent(call: PluginCall) {
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        
        val scopesArray = call.getArray("scopes") ?: run {
            call.reject("Missing scopes")
            return
        }
        
        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl()
        val url = "$backendUrl/api/kai/consent/grant"
        
        val json = JSONObject().apply {
            put("user_id", userId)
            put("scopes", scopesArray)
        }
        
        val client = OkHttpClient()
        val body = json.toString().toRequestBody("application/json".toMediaType())
        
        val requestBuilder = Request.Builder().url(url).post(body)
        
        if (authToken != null) {
            requestBuilder.addHeader("Authorization", "Bearer $authToken")
        }
        
        val request = requestBuilder.build()
        val pluginCall = call // Rename to avoid shadowing in callback
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                pluginCall.reject("Network error: ${e.message}")
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                
                if (!response.isSuccessful || responseBody == null) {
                    pluginCall.reject("Request failed: ${response.code}")
                    return
                }
                
                try {
                    val result = JSObject(responseBody)
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    pluginCall.reject("JSON parsing error: ${e.message}")
                }
            }
        })
    }
    
    @PluginMethod
    fun analyze(call: PluginCall) {
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        val ticker = call.getString("ticker") ?: run {
            call.reject("Missing ticker")
            return
        }
        val consentToken = call.getString("consentToken") ?: run {
            call.reject("Missing consentToken")
            return
        }
        val riskProfile = call.getString("riskProfile") ?: run {
            call.reject("Missing riskProfile")
            return
        }
        val processingMode = call.getString("processingMode") ?: run {
            call.reject("Missing processingMode")
            return
        }
        
        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl()
        val url = "$backendUrl/api/kai/analyze"
        
        val json = JSONObject().apply {
            put("user_id", userId)
            put("ticker", ticker)
            put("consent_token", consentToken)
            put("risk_profile", riskProfile)
            put("processing_mode", processingMode)
        }
        
        val client = OkHttpClient()
        val body = json.toString().toRequestBody("application/json".toMediaType())
        
        val requestBuilder = Request.Builder().url(url).post(body)
        
        if (authToken != null) {
            requestBuilder.addHeader("Authorization", "Bearer $authToken")
        }
        
        val request = requestBuilder.build()
        val pluginCall = call
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                pluginCall.reject("Network error: ${e.message}")
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                
                if (!response.isSuccessful || responseBody == null) {
                    pluginCall.reject("Request failed: ${response.code}")
                    return
                }
                
                try {
                    // Return full response directly, matching web plugin
                    val result = JSObject(responseBody)
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    pluginCall.reject("JSON parsing error: ${e.message}")
                }
            }
        })
    }
    
    @PluginMethod
    fun storePreferences(call: PluginCall) {
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }

        // Canonical payload: preferences array (preferred)
        val preferencesArray = call.getArray("preferences")
        val preferencesEncrypted = call.getString("preferencesEncrypted") // legacy
        if (preferencesArray == null && preferencesEncrypted == null) {
            call.reject("Missing preferences payload")
            return
        }
        
        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl()
        val url = "$backendUrl/api/kai/preferences/store"
        
        val json = JSONObject().apply {
            put("user_id", userId)
            when {
                preferencesArray != null -> put("preferences", preferencesArray)
                else -> {
                    // Legacy: parse stringified JSON array
                    val parsed = JSONArray(preferencesEncrypted)
                    put("preferences", parsed)
                }
            }
        }
        
        val client = OkHttpClient()
        val body = json.toString().toRequestBody("application/json".toMediaType())
        
        val requestBuilder = Request.Builder().url(url).post(body)
        
        if (authToken != null) {
            requestBuilder.addHeader("Authorization", "Bearer $authToken")
        }
        
        val request = requestBuilder.build()
        val pluginCall = call
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                pluginCall.reject("Network error: ${e.message}")
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                
                if (!response.isSuccessful || responseBody == null) {
                    pluginCall.reject("Request failed: ${response.code}")
                    return
                }
                
                try {
                    val result = JSObject(responseBody)
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    pluginCall.reject("JSON parsing error: ${e.message}")
                }
            }
        })
    }
    
    @PluginMethod
    fun getPreferences(call: PluginCall) {
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        
        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl()
        val url = "$backendUrl/api/kai/preferences/$userId"
        
        android.util.Log.d("KaiPlugin", "🔍 getPreferences called for userId: $userId")
        android.util.Log.d("KaiPlugin", "🌐 URL: $url")
        
        val client = OkHttpClient()
        
        val requestBuilder = Request.Builder().url(url).get()
        
        if (authToken != null) {
            requestBuilder.addHeader("Authorization", "Bearer $authToken")
            android.util.Log.d("KaiPlugin", "🔑 Auth token added")
        }
        
        val request = requestBuilder.build()
        val pluginCall = call
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                android.util.Log.e("KaiPlugin", "❌ Network error getting preferences: ${e.message}")
                pluginCall.reject("Network error: ${e.message}")
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                
                android.util.Log.d("KaiPlugin", "📡 Response code: ${response.code}")
                android.util.Log.d("KaiPlugin", "📦 Response body: ${responseBody?.take(200)}")
                
                if (!response.isSuccessful || responseBody == null) {
                    android.util.Log.e("KaiPlugin", "❌ Failed to get preferences: HTTP ${response.code}")
                    pluginCall.reject("Request failed: ${response.code}")
                    return
                }
                
                try {
                    val result = JSObject(responseBody)
                    android.util.Log.d("KaiPlugin", "✅ Preferences retrieved successfully")
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    android.util.Log.e("KaiPlugin", "❌ JSON parsing error: ${e.message}")
                    pluginCall.reject("JSON parsing error: ${e.message}")
                }
            }
        })
    }

    @PluginMethod
    fun resetPreferences(call: PluginCall) {
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        val vaultOwnerToken = call.getString("vaultOwnerToken") ?: run {
            call.reject("Missing vaultOwnerToken")
            return
        }

        val backendUrl = getBackendUrl()
        val url = "$backendUrl/api/kai/preferences/$userId"

        val client = OkHttpClient()
        val request = Request.Builder()
            .url(url)
            .delete()
            .addHeader("Authorization", "Bearer $vaultOwnerToken")
            .build()

        val pluginCall = call
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                pluginCall.reject("Network error: ${e.message}")
            }

            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                if (!response.isSuccessful) {
                    pluginCall.reject("Request failed: ${response.code}")
                    return
                }
                try {
                    val result = if (responseBody.isNullOrBlank()) {
                        JSObject().put("success", true)
                    } else {
                        JSObject(responseBody)
                    }
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    pluginCall.resolve(JSObject().put("success", true))
                }
            }
        })
    }
}
