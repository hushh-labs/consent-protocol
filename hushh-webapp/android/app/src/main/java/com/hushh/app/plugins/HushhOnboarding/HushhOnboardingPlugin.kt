package com.hushh.app.plugins.HushhOnboarding

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * HushhOnboardingPlugin - Onboarding tour completion status (Capacitor 8)
 *
 * Same contract as iOS HushhOnboardingPlugin and web onboarding-web.ts.
 * - checkOnboardingStatus: GET /api/onboarding/status?userId=...
 * - completeOnboarding: POST /api/onboarding/complete with { userId }
 *
 * Backend URL from capacitor.config: plugins.HushhOnboarding.backendUrl
 */
@CapacitorPlugin(name = "HushhOnboarding")
class HushhOnboardingPlugin : Plugin() {

    private val TAG = "HushhOnboarding"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"

    private fun normalizeBackendUrl(raw: String): String {
        return if (raw.contains("localhost")) raw.replace("localhost", "10.0.2.2") else raw
    }

    private fun getBackendUrl(call: PluginCall? = null): String {
        val callUrl = call?.getString("backendUrl")
        if (!callUrl.isNullOrBlank()) return normalizeBackendUrl(callUrl)

        val pluginUrl = bridge.config.getString("plugins.HushhOnboarding.backendUrl")
        if (!pluginUrl.isNullOrBlank()) return normalizeBackendUrl(pluginUrl)

        val envUrl = System.getenv("NEXT_PUBLIC_BACKEND_URL")
        if (!envUrl.isNullOrBlank()) return normalizeBackendUrl(envUrl)

        return normalizeBackendUrl(defaultBackendUrl)
    }

    @PluginMethod
    fun checkOnboardingStatus(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId.isNullOrBlank()) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)
        val encodedUserId = java.net.URLEncoder.encode(userId, Charsets.UTF_8.name())
        val url = "$backendUrl/api/onboarding/status?userId=$encodedUserId"

        Log.d(TAG, "checkOnboardingStatus url=$url")

        Thread {
            try {
                val requestBuilder = Request.Builder()
                    .url(url)
                    .get()
                    .addHeader("Content-Type", "application/json")
                if (!authToken.isNullOrBlank()) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }
                val request = requestBuilder.build()

                val response = httpClient.newCall(request).execute()
                val body = response.body?.string() ?: "{}"

                if (!response.isSuccessful) {
                    Log.w(TAG, "checkOnboardingStatus non-OK: ${response.code}")
                    call.resolve(JSObject().put("completed", false).put("completedAt", JSONObject.NULL))
                    return@Thread
                }

                val json = JSONObject(body)
                val completed = json.optBoolean("completed", false)
                val completedAt = if (json.has("completedAt") && !json.isNull("completedAt")) {
                    json.optString("completedAt", null)
                } else null

                Log.d(TAG, "Onboarding status for $userId: completed=$completed")
                val result = JSObject()
                result.put("completed", completed)
                result.put("completedAt", completedAt)
                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "checkOnboardingStatus error", e)
                call.reject("Network error: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun completeOnboarding(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId.isNullOrBlank()) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = getBackendUrl(call)
        val url = "$backendUrl/api/onboarding/complete"

        Log.d(TAG, "completeOnboarding url=$url userId=$userId")

        Thread {
            try {
                val body = JSONObject().put("userId", userId).toString()
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .addHeader("Content-Type", "application/json")
                if (!authToken.isNullOrBlank()) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }
                val request = requestBuilder.build()

                val response = httpClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: "{}"

                if (!response.isSuccessful) {
                    Log.w(TAG, "completeOnboarding non-OK: ${response.code}")
                    call.resolve(JSObject().put("success", false))
                    return@Thread
                }

                val json = JSONObject(responseBody)
                val success = json.optBoolean("success", false)
                call.resolve(JSObject().put("success", success))
            } catch (e: Exception) {
                Log.e(TAG, "completeOnboarding error", e)
                call.reject("Network error: ${e.message}")
            }
        }
    }
}
