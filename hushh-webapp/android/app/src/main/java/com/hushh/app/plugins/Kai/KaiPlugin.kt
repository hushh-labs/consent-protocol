package com.hushh.app.plugins.Kai

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.json.JSONArray
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Kai Plugin - Android Implementation
 * 
 * Native plugin for Agent Kai stock analysis.
 * Makes HTTP calls to backend from native code.
 *
 * Authentication:
 * - All consent-gated operations use VAULT_OWNER token
 * - Token proves both identity (user_id) and consent (vault unlocked)
 * - Firebase is only used for bootstrap (issuing VAULT_OWNER token)
 */

@CapacitorPlugin(name = "Kai")
class KaiPlugin : Plugin() {
    
    private val TAG = "KaiPlugin"

    // OkHttp client with explicit timeouts (Kai analysis can take longer than typical API calls)
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .readTimeout(150, TimeUnit.SECONDS)
        .callTimeout(170, TimeUnit.SECONDS)
        .build()

    private val defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"

    private fun getBackendUrl(call: PluginCall? = null): String {
        // 1) Allow override per-call (useful for local dev/testing)
        val callUrl = call?.getString("backendUrl")
        if (!callUrl.isNullOrBlank()) {
            return normalizeBackendUrl(callUrl)
        }

        // 2) Prefer plugin-scoped config from capacitor.config.ts: plugins.Kai.backendUrl
        // Capacitor Android config is exposed via bridge.config; dot-path access works for nested config.
        val pluginConfigUrl = bridge.config.getString("plugins.Kai.backendUrl")
        if (!pluginConfigUrl.isNullOrBlank()) {
            return normalizeBackendUrl(pluginConfigUrl)
        }

        // 3) Environment fallback (rare on-device, but useful for CI/local)
        val envUrl = System.getenv("NEXT_PUBLIC_BACKEND_URL")
        if (!envUrl.isNullOrBlank()) {
            return normalizeBackendUrl(envUrl)
        }

        // 4) Final fallback: production Cloud Run
        return normalizeBackendUrl(defaultBackendUrl)
    }

    private fun normalizeBackendUrl(raw: String): String {
        // Android emulator: convert localhost to 10.0.2.2
        return if (raw.contains("localhost")) {
            raw.replace("localhost", "10.0.2.2")
        } else {
            raw
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
        
        // Bootstrap route: backend requires Firebase ID token (NOT VAULT_OWNER).
        val authToken = call.getString("authToken") ?: run {
            call.reject("Missing authToken (Firebase ID token)")
            return
        }
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/consent/grant"
        
        val json = JSONObject().apply {
            put("user_id", userId)
            put("scopes", scopesArray)
        }
        
        val body = json.toString().toRequestBody("application/json".toMediaType())
        
        val requestBuilder = Request.Builder().url(url).post(body)
        
        requestBuilder.addHeader("Authorization", "Bearer $authToken")
        
        val request = requestBuilder.build()
        val pluginCall = call // Rename to avoid shadowing in callback
        
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [analyze] $errorMsg")
                pluginCall.reject(errorMsg)
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                
                if (!response.isSuccessful || responseBody == null) {
                    pluginCall.reject("Request failed: ${response.code}")
                    return
                }
                
                try {
                    // Normalize to TS contract: { token, expires_at }
                    val json = JSONObject(responseBody)
                    val tokensObj = json.optJSONObject("tokens")
                    if (tokensObj != null) {
                        val token =
                            tokensObj.optString("agent.kai.analyze").takeIf { it.isNotBlank() }
                                ?: run {
                                    val keys = tokensObj.keys()
                                    if (keys.hasNext()) tokensObj.optString(keys.next()) else ""
                                }
                        val expiresAt = json.optString("expires_at", "")
                        pluginCall.resolve(JSObject().apply {
                            put("token", token)
                            put("expires_at", expiresAt)
                        })
                    } else {
                        pluginCall.resolve(JSObject(responseBody))
                    }
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
        
        // Consent-gated: requires VAULT_OWNER token
        val vaultOwnerToken = call.getString("vaultOwnerToken") ?: run {
            call.reject("Missing vaultOwnerToken")
            return
        }
        val contextObj = call.getObject("context") // Optional context object
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/analyze"
        
        val json = JSONObject().apply {
            put("user_id", userId)
            put("ticker", ticker)
            put("consent_token", consentToken)
            put("risk_profile", riskProfile)
            put("processing_mode", processingMode)
            // Include context if provided
            if (contextObj != null) {
                put("context", contextObj)
            }
        }
        
        val body = json.toString().toRequestBody("application/json".toMediaType())
        
        val requestBuilder = Request.Builder().url(url).post(body)
        
        requestBuilder.addHeader("Authorization", "Bearer $vaultOwnerToken")
        
        val request = requestBuilder.build()
        val pluginCall = call
        
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [analyze] $errorMsg")
                pluginCall.reject(errorMsg)
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                val truncatedBody = if (responseBody != null && responseBody.length > 200) responseBody.take(200) + "..." else responseBody
                
                if (!response.isSuccessful || responseBody == null) {
                    val errorMsg = "Request failed: HTTP ${response.code} | backendUrl: $backendUrl" + 
                        if (truncatedBody != null) " | body: $truncatedBody" else ""
                    android.util.Log.e(TAG, "❌ [analyze] $errorMsg")
                    pluginCall.reject(errorMsg)
                    return
                }
                
                try {
                    // Return full response directly, matching web plugin
                    val result = JSObject(responseBody)
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    val errorMsg = "JSON parsing error: ${e.message} | backendUrl: $backendUrl"
                    android.util.Log.e(TAG, "❌ [analyze] $errorMsg")
                    pluginCall.reject(errorMsg)
                }
            }
        })
    }

    @PluginMethod
    fun analyzePortfolioLosers(call: PluginCall) {
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }

        val losersArray = call.getArray("losers") ?: run {
            call.reject("Missing losers")
            return
        }

        val vaultOwnerToken = call.getString("vaultOwnerToken") ?: run {
            call.reject("Missing vaultOwnerToken")
            return
        }

        val thresholdPct = call.getDouble("thresholdPct") ?: -5.0
        val maxPositions = call.getInt("maxPositions") ?: 10

        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/portfolio/analyze-losers"

        val json = JSONObject().apply {
            put("user_id", userId)
            put("losers", losersArray)
            put("threshold_pct", thresholdPct)
            put("max_positions", maxPositions)
        }

        val body = json.toString().toRequestBody("application/json".toMediaType())
        val requestBuilder = Request.Builder().url(url).post(body)
        requestBuilder.addHeader("Authorization", "Bearer $vaultOwnerToken")

        val request = requestBuilder.build()
        val pluginCall = call

        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [analyzePortfolioLosers] $errorMsg")
                pluginCall.reject(errorMsg)
            }

            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                val truncatedBody =
                    if (responseBody != null && responseBody.length > 500) responseBody.take(500) + "..." else responseBody

                if (!response.isSuccessful || responseBody == null) {
                    val errorMsg = "Request failed: HTTP ${response.code} | backendUrl: $backendUrl" +
                        if (truncatedBody != null) " | body: $truncatedBody" else ""
                    android.util.Log.e(TAG, "❌ [analyzePortfolioLosers] $errorMsg")
                    pluginCall.reject(errorMsg)
                    return
                }

                try {
                    val result = JSObject(responseBody)
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    val errorMsg = "JSON parsing error: ${e.message} | backendUrl: $backendUrl"
                    android.util.Log.e(TAG, "❌ [analyzePortfolioLosers] $errorMsg")
                    pluginCall.reject(errorMsg)
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
        
        // Use VAULT_OWNER token for consent-gated access
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        val backendUrl = getBackendUrl(call)
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
        
        val body = json.toString().toRequestBody("application/json".toMediaType())
        
        val requestBuilder = Request.Builder().url(url).post(body)
        
        if (vaultOwnerToken != null) {
            requestBuilder.addHeader("Authorization", "Bearer $vaultOwnerToken")
        }
        
        val request = requestBuilder.build()
        val pluginCall = call
        
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [analyze] $errorMsg")
                pluginCall.reject(errorMsg)
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
        
        // Use VAULT_OWNER token for consent-gated access
        val vaultOwnerToken = call.getString("vaultOwnerToken")
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/preferences/$userId"
        
        android.util.Log.d("KaiPlugin", "🔍 getPreferences called for userId: $userId")
        android.util.Log.d("KaiPlugin", "🌐 URL: $url")
        
        val requestBuilder = Request.Builder().url(url).get()
        
        if (vaultOwnerToken != null) {
            requestBuilder.addHeader("Authorization", "Bearer $vaultOwnerToken")
            android.util.Log.d("KaiPlugin", "🔑 VAULT_OWNER token added")
        }
        
        val request = requestBuilder.build()
        val pluginCall = call
        
        httpClient.newCall(request).enqueue(object : Callback {
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

        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/preferences/$userId"

        val request = Request.Builder()
            .url(url)
            .delete()
            .addHeader("Authorization", "Bearer $vaultOwnerToken")
            .build()

        val pluginCall = call
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [analyze] $errorMsg")
                pluginCall.reject(errorMsg)
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

    @PluginMethod
    fun importPortfolio(call: PluginCall) {
        android.util.Log.d(TAG, "🔍 importPortfolio called")
        
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        val fileName = call.getString("fileName") ?: run {
            call.reject("Missing fileName")
            return
        }
        val mimeType = call.getString("mimeType") ?: run {
            call.reject("Missing mimeType")
            return
        }
        // Use VAULT_OWNER token for consent-gated access
        val vaultOwnerToken = call.getString("vaultOwnerToken") ?: run {
            call.reject("Missing vaultOwnerToken")
            return
        }
        val fileBase64 = call.getString("fileBase64") ?: run {
            call.reject("Missing fileBase64")
            return
        }
        
        // Decode base64 file content
        val fileData: ByteArray
        try {
            fileData = android.util.Base64.decode(fileBase64, android.util.Base64.DEFAULT)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "❌ Invalid base64 file content: ${e.message}")
            call.reject("Invalid base64 file content")
            return
        }
        
        // Check file size (max 10MB)
        if (fileData.size > 10 * 1024 * 1024) {
            android.util.Log.e(TAG, "❌ File too large: ${fileData.size} bytes")
            call.reject("File too large. Maximum size is 10MB.")
            return
        }
        
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/portfolio/import"
        
        android.util.Log.d(TAG, "🌐 URL: $url")
        android.util.Log.d(TAG, "📁 File: $fileName (${fileData.size} bytes)")
        
        // Build multipart request body
        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("user_id", userId)
            .addFormDataPart(
                "file",
                fileName,
                fileData.toRequestBody(mimeType.toMediaType())
            )
            .build()
        
        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Authorization", "Bearer $vaultOwnerToken")
            .build()
        
        val pluginCall = call
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [importPortfolio] $errorMsg")
                pluginCall.reject(errorMsg)
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                val truncatedBody = if (responseBody != null && responseBody.length > 500) {
                    responseBody.take(500) + "..."
                } else {
                    responseBody
                }
                
                if (!response.isSuccessful || responseBody == null) {
                    val errorMsg = "Request failed: HTTP ${response.code} | backendUrl: $backendUrl" +
                        if (truncatedBody != null) " | body: $truncatedBody" else ""
                    android.util.Log.e(TAG, "❌ [importPortfolio] $errorMsg")
                    pluginCall.reject(errorMsg)
                    return
                }
                
                try {
                    val result = JSObject(responseBody)
                    android.util.Log.d(TAG, "✅ importPortfolio success: holdings=${result.optInt("holdings_count", -1)}")
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    val errorMsg = "JSON parsing error: ${e.message} | backendUrl: $backendUrl"
                    android.util.Log.e(TAG, "❌ [importPortfolio] $errorMsg")
                    pluginCall.reject(errorMsg)
                }
            }
        })
    }

    @PluginMethod
    fun chat(call: PluginCall) {
        android.util.Log.d(TAG, "🔍 chat called")
        
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        val message = call.getString("message") ?: run {
            call.reject("Missing message")
            return
        }
        // Use VAULT_OWNER token for consent-gated access
        val vaultOwnerToken = call.getString("vaultOwnerToken") ?: run {
            call.reject("Missing vaultOwnerToken")
            return
        }
        
        val conversationId = call.getString("conversationId")
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/chat"
        
        android.util.Log.d(TAG, "🌐 URL: $url")
        
        val json = JSONObject().apply {
            put("user_id", userId)
            put("message", message)
            if (conversationId != null) {
                put("conversation_id", conversationId)
            }
        }
        
        val body = json.toString().toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url(url)
            .post(body)
            .addHeader("Authorization", "Bearer $vaultOwnerToken")
            .build()
        
        val pluginCall = call
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [chat] $errorMsg")
                pluginCall.reject(errorMsg)
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                val truncatedBody = if (responseBody != null && responseBody.length > 200) {
                    responseBody.take(200) + "..."
                } else {
                    responseBody
                }
                
                if (!response.isSuccessful || responseBody == null) {
                    val errorMsg = "Request failed: HTTP ${response.code} | backendUrl: $backendUrl" +
                        if (truncatedBody != null) " | body: $truncatedBody" else ""
                    android.util.Log.e(TAG, "❌ [chat] $errorMsg")
                    pluginCall.reject(errorMsg)
                    return
                }
                
                try {
                    val result = JSObject(responseBody)
                    android.util.Log.d(TAG, "✅ chat success")
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    val errorMsg = "JSON parsing error: ${e.message} | backendUrl: $backendUrl"
                    android.util.Log.e(TAG, "❌ [chat] $errorMsg")
                    pluginCall.reject(errorMsg)
                }
            }
        })
    }

    @PluginMethod
    fun getInitialChatState(call: PluginCall) {
        android.util.Log.d(TAG, "🔍 getInitialChatState called")
        
        val userId = call.getString("userId") ?: run {
            call.reject("Missing userId")
            return
        }
        
        // Use VAULT_OWNER token for consent-gated access
        val vaultOwnerToken = call.getString("vaultOwnerToken") ?: run {
            call.reject("Missing vaultOwnerToken")
            return
        }
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/kai/chat/initial-state/$userId"
        
        android.util.Log.d(TAG, "🌐 URL: $url")
        
        val requestBuilder = Request.Builder()
            .url(url)
            .get()
            .addHeader("Authorization", "Bearer $vaultOwnerToken")
        
        val request = requestBuilder.build()
        val pluginCall = call
        
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                val errorMsg = "Network error: ${e.message} | backendUrl: $backendUrl"
                android.util.Log.e(TAG, "❌ [getInitialChatState] $errorMsg")
                pluginCall.reject(errorMsg)
            }
            
            override fun onResponse(call: okhttp3.Call, response: Response) {
                val responseBody = response.body?.string()
                val truncatedBody = if (responseBody != null && responseBody.length > 200) {
                    responseBody.take(200) + "..."
                } else {
                    responseBody
                }
                
                if (!response.isSuccessful || responseBody == null) {
                    val errorMsg = "Request failed: HTTP ${response.code} | backendUrl: $backendUrl" +
                        if (truncatedBody != null) " | body: $truncatedBody" else ""
                    android.util.Log.e(TAG, "❌ [getInitialChatState] $errorMsg")
                    pluginCall.reject(errorMsg)
                    return
                }
                
                try {
                    val result = JSObject(responseBody)
                    android.util.Log.d(TAG, "✅ getInitialChatState success")
                    pluginCall.resolve(result)
                } catch (e: Exception) {
                    val errorMsg = "JSON parsing error: ${e.message} | backendUrl: $backendUrl"
                    android.util.Log.e(TAG, "❌ [getInitialChatState] $errorMsg")
                    pluginCall.reject(errorMsg)
                }
            }
        })
    }
}
