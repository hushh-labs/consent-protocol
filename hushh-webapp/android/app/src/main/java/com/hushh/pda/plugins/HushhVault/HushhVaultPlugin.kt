package com.hushh.pda.plugins.HushhVault

import android.util.Base64
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
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Hushh Vault Plugin - Encryption + Cloud DB Proxy
 * Port of lib/vault/encrypt.ts and iOS HushhVaultPlugin.swift
 *
 * Uses: AES-256-GCM, PBKDF2 with 100,000 iterations
 */
@CapacitorPlugin(name = "HushhVault")
class HushhVaultPlugin : Plugin() {

    private val TAG = "HushhVault"
    private val httpClient = OkHttpClient()

    // Default Cloud Run backend URL (fallback if not provided by JS layer)
    private val defaultBackendUrl = "https://consent-protocol-1006304528804.us-central1.run.app"

    // ==================== Derive Key ====================

    @PluginMethod
    fun deriveKey(call: PluginCall) {
        val passphrase = call.getString("passphrase")
        if (passphrase == null) {
            call.reject("Missing required parameter: passphrase")
            return
        }

        val saltString = call.getString("salt")
        val iterations = call.getInt("iterations") ?: 100000

        try {
            // Generate or use provided salt
            val salt = if (saltString != null) {
                hexStringToByteArray(saltString)
            } else {
                ByteArray(32).also { SecureRandom().nextBytes(it) }
            }

            // PBKDF2 key derivation
            val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val spec = PBEKeySpec(passphrase.toCharArray(), salt, iterations, 256)
            val key = factory.generateSecret(spec)

            val keyHex = key.encoded.toHexString()
            val saltHex = salt.toHexString()

            Log.d(TAG, "✅ [HushhVault] Key derived successfully")

            call.resolve(JSObject().apply {
                put("keyHex", keyHex)
                put("salt", saltHex)
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ [HushhVault] Key derivation failed: ${e.message}")
            call.reject("Key derivation failed: ${e.message}")
        }
    }

    // ==================== Encrypt Data ====================

    @PluginMethod
    fun encryptData(call: PluginCall) {
        val plaintext = call.getString("plaintext")
        val keyHex = call.getString("keyHex")

        if (plaintext == null || keyHex == null) {
            call.reject("Missing required parameters: plaintext, keyHex")
            return
        }

        try {
            val key = hexStringToByteArray(keyHex)
            val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val secretKey = SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec)

            val encrypted = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

            // Split ciphertext and tag (last 16 bytes is the auth tag in GCM)
            val ciphertext = encrypted.dropLast(16).toByteArray()
            val tag = encrypted.takeLast(16).toByteArray()

            Log.d(TAG, "✅ [HushhVault] Data encrypted successfully")

            call.resolve(JSObject().apply {
                put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
                put("tag", Base64.encodeToString(tag, Base64.NO_WRAP))
                put("encoding", "base64")
                put("algorithm", "aes-256-gcm")
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ [HushhVault] Encryption failed: ${e.message}")
            call.reject("Encryption failed: ${e.message}")
        }
    }

    // ==================== Decrypt Data ====================

    @PluginMethod
    fun decryptData(call: PluginCall) {
        val payload = call.getObject("payload")
        val keyHex = call.getString("keyHex")

        if (payload == null || keyHex == null) {
            call.reject("Missing required parameters: payload, keyHex")
            return
        }

        try {
            val ciphertextStr = payload.getString("ciphertext")
            val ivStr = payload.getString("iv")
            val tagStr = payload.getString("tag")

            if (ciphertextStr == null || ivStr == null || tagStr == null) {
                call.reject("Invalid payload: missing ciphertext, iv, or tag")
                return
            }

            val key = hexStringToByteArray(keyHex)
            val ciphertext = Base64.decode(ciphertextStr, Base64.DEFAULT)
            val iv = Base64.decode(ivStr, Base64.DEFAULT)
            val tag = Base64.decode(tagStr, Base64.DEFAULT)

            // Combine ciphertext + tag for GCM
            val combined = ciphertext + tag

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val secretKey = SecretKeySpec(key, "AES")
            val gcmSpec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)

            val decrypted = cipher.doFinal(combined)
            val plaintext = String(decrypted, Charsets.UTF_8)

            Log.d(TAG, "✅ [HushhVault] Data decrypted successfully")

            call.resolve(JSObject().put("plaintext", plaintext))
        } catch (e: Exception) {
            Log.e(TAG, "❌ [HushhVault] Decryption failed: ${e.message}")
            call.reject("Decryption failed: ${e.message}")
        }
    }

    // ==================== Cloud DB Methods ====================

    @PluginMethod
    fun hasVault(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        // iOS uses POST to /db/vault/check with JSON body
        val url = "$backendUrl/db/vault/check"
        
        Log.d(TAG, "🔐 [hasVault] Checking vault for userId: $userId")
        Log.d(TAG, "🔐 [hasVault] URL: $url")
        Log.d(TAG, "🔐 [hasVault] AuthToken present: ${authToken != null}")

        Thread {
            try {
                // Create JSON body like iOS does
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val responseCode = response.code
                val body = response.body?.string() ?: "{}"
                
                Log.d(TAG, "🔐 [hasVault] Response code: $responseCode")
                Log.d(TAG, "🔐 [hasVault] Response body: $body")
                
                val json = JSONObject(body)
                
                // Backend returns hasVault
                val exists = json.optBoolean("hasVault", false)
                
                Log.d(TAG, "🔐 [hasVault] Parsed exists: $exists")

                activity.runOnUiThread {
                    call.resolve(JSObject().put("exists", exists))
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [hasVault] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Failed to check vault: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun getVault(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        // iOS uses POST to /db/vault/get with JSON body
        val url = "$backendUrl/db/vault/get"

        Thread {
            try {
                // Create JSON body like iOS does
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val body = response.body?.string() ?: "{}"
                val json = JSONObject(body)

                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("authMethod", json.optString("authMethod", "passphrase"))
                        put("encryptedVaultKey", json.optString("encryptedVaultKey", ""))
                        put("salt", json.optString("salt", ""))
                        put("iv", json.optString("iv", ""))
                        put("recoveryEncryptedVaultKey", json.optString("recoveryEncryptedVaultKey", ""))
                        put("recoverySalt", json.optString("recoverySalt", ""))
                        put("recoveryIv", json.optString("recoveryIv", ""))
                    })
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    call.reject("Failed to get vault: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun setupVault(call: PluginCall) {
        val userId = call.getString("userId")
        val encryptedVaultKey = call.getString("encryptedVaultKey")
        val salt = call.getString("salt")
        val iv = call.getString("iv")
        val recoveryEncryptedVaultKey = call.getString("recoveryEncryptedVaultKey")
        val recoverySalt = call.getString("recoverySalt")
        val recoveryIv = call.getString("recoveryIv")

        if (userId == null || encryptedVaultKey == null || salt == null || iv == null) {
            call.reject("Missing required parameters")
            return
        }

        val authToken = call.getString("authToken")
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val authMethod = call.getString("authMethod") ?: "passphrase"

        Thread {
            try {
                val json = JSONObject().apply {
                    put("userId", userId)
                    put("authMethod", authMethod)
                    put("encryptedVaultKey", encryptedVaultKey)
                    put("salt", salt)
                    put("iv", iv)
                    put("recoveryEncryptedVaultKey", recoveryEncryptedVaultKey ?: "")
                    put("recoverySalt", recoverySalt ?: "")
                    put("recoveryIv", recoveryIv ?: "")
                }

                val requestBody = json.toString().toRequestBody("application/json".toMediaType())
                val requestBuilder = Request.Builder()
                    .url("$backendUrl/db/vault/setup")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val success = response.isSuccessful

                activity.runOnUiThread {
                    call.resolve(JSObject().put("success", success))
                }
            } catch (e: Exception) {
                activity.runOnUiThread {
                    call.reject("Failed to setup vault: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Domain Data Methods ====================
    // These call Cloud Run backend to get/store encrypted user data

    @PluginMethod
    fun getFoodPreferences(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val sessionToken = call.getString("sessionToken")
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/db/food/get"

        Log.d(TAG, "🍽️ [getFoodPreferences] Fetching food data for userId: $userId")

        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }
                if (sessionToken != null) {
                    requestBuilder.addHeader("X-Session-Token", sessionToken)
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val responseCode = response.code
                val body = response.body?.string() ?: "{}"
                
                Log.d(TAG, "🍽️ [getFoodPreferences] Response code: $responseCode")

                if (responseCode == 404) {
                    // No data found - return empty preferences
                    activity.runOnUiThread {
                        call.resolve(JSObject().apply {
                            put("domain", "food")
                            put("preferences", JSONObject.NULL)
                        })
                    }
                    return@Thread
                }

                if (responseCode != 200) {
                    Log.e(TAG, "❌ [getFoodPreferences] Error: $body")
                    activity.runOnUiThread {
                        call.reject("Failed to get food preferences: HTTP $responseCode")
                    }
                    return@Thread
                }

                val json = JSONObject(body)
                val preferences = json.optJSONObject("preferences")

                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("domain", "food")
                        put("preferences", preferences ?: JSONObject.NULL)
                    })
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [getFoodPreferences] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Failed to get food preferences: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun getProfessionalData(call: PluginCall) {
        val userId = call.getString("userId")
        if (userId == null) {
            call.reject("Missing required parameter: userId")
            return
        }

        val authToken = call.getString("authToken")
        val sessionToken = call.getString("sessionToken")
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/db/professional/get"

        Log.d(TAG, "💼 [getProfessionalData] Fetching professional data for userId: $userId")

        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }
                if (sessionToken != null) {
                    requestBuilder.addHeader("X-Session-Token", sessionToken)
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val responseCode = response.code
                val body = response.body?.string() ?: "{}"
                
                Log.d(TAG, "💼 [getProfessionalData] Response code: $responseCode")

                if (responseCode == 404) {
                    // No data found - return empty preferences
                    activity.runOnUiThread {
                        call.resolve(JSObject().apply {
                            put("domain", "professional")
                            put("preferences", JSONObject.NULL)
                        })
                    }
                    return@Thread
                }

                if (responseCode != 200) {
                    Log.e(TAG, "❌ [getProfessionalData] Error: $body")
                    activity.runOnUiThread {
                        call.reject("Failed to get professional data: HTTP $responseCode")
                    }
                    return@Thread
                }

                val json = JSONObject(body)
                val preferences = json.optJSONObject("preferences")

                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("domain", "professional")
                        put("preferences", preferences ?: JSONObject.NULL)
                    })
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [getProfessionalData] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Failed to get professional data: ${e.message}")
                }
            }
        }.start()
    }

    @PluginMethod
    fun storePreferencesToCloud(call: PluginCall) {
        val userId = call.getString("userId")
        val domain = call.getString("domain")
        val fieldName = call.getString("fieldName")
        val ciphertext = call.getString("ciphertext")
        val iv = call.getString("iv")
        val tag = call.getString("tag")

        if (userId == null || domain == null || fieldName == null || 
            ciphertext == null || iv == null || tag == null) {
            call.reject("Missing required parameters")
            return
        }

        val authToken = call.getString("authToken")
        val consentToken = call.getString("consentToken")
        val backendUrl = call.getString("backendUrl") ?: defaultBackendUrl
        val url = "$backendUrl/db/$domain/store"

        Log.d(TAG, "💾 [storePreferencesToCloud] Storing $fieldName for userId: $userId")

        Thread {
            try {
                val jsonBody = JSONObject().apply {
                    put("userId", userId)
                    put("fieldName", fieldName)
                    put("ciphertext", ciphertext)
                    put("iv", iv)
                    put("tag", tag)
                    if (consentToken != null) {
                        put("consentToken", consentToken)
                    }
                }
                val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
                
                val requestBuilder = Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")

                if (authToken != null) {
                    requestBuilder.addHeader("Authorization", "Bearer $authToken")
                }

                val response = httpClient.newCall(requestBuilder.build()).execute()
                val responseCode = response.code
                val body = response.body?.string() ?: "{}"
                
                Log.d(TAG, "💾 [storePreferencesToCloud] Response code: $responseCode")

                if (responseCode != 200 && responseCode != 201) {
                    Log.e(TAG, "❌ [storePreferencesToCloud] Error: $body")
                    activity.runOnUiThread {
                        call.reject("Failed to store preferences: HTTP $responseCode")
                    }
                    return@Thread
                }

                activity.runOnUiThread {
                    call.resolve(JSObject().apply {
                        put("success", true)
                        put("field", fieldName)
                    })
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ [storePreferencesToCloud] Error: ${e.message}")
                activity.runOnUiThread {
                    call.reject("Failed to store preferences: ${e.message}")
                }
            }
        }.start()
    }

    // ==================== Preference Storage (Placeholder for SQLCipher) ====================

    @PluginMethod
    fun storePreference(call: PluginCall) {
        // Placeholder - will be implemented with SQLCipher
        call.resolve()
    }

    @PluginMethod
    fun getPreferences(call: PluginCall) {
        // Placeholder - will be implemented with SQLCipher
        call.resolve(JSObject().put("preferences", JSObject()))
    }

    @PluginMethod
    fun deletePreferences(call: PluginCall) {
        // Placeholder - will be implemented with SQLCipher
        call.resolve()
    }

    // ==================== Utility Functions ====================

    private fun ByteArray.toHexString(): String = joinToString("") { "%02x".format(it) }

    private fun hexStringToByteArray(hex: String): ByteArray {
        val result = ByteArray(hex.length / 2)
        for (i in result.indices) {
            result[i] = hex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
        return result
    }
}
