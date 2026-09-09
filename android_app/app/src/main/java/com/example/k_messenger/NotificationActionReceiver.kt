package com.example.k_messenger

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class NotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_REPLY = "com.example.k_messenger.ACTION_REPLY"
        const val ACTION_LIKE = "com.example.k_messenger.ACTION_LIKE"
        const val ACTION_DECLINE_CALL = "com.example.k_messenger.ACTION_DECLINE_CALL"

        const val KEY_TEXT_REPLY = "key_text_reply"
        const val EXTRA_MESSAGE_ID = "extra_message_id"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"

        private const val SUPABASE_URL = "https://eccrzzfjljzqmwjcizwj.supabase.co"
        private const val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3J6emZqbGp6cW13amNpendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTYxNjUsImV4cCI6MjEwNDI5MjE2NX0.goZ1-JPcAUkO9JXVCDjTFPkcxBJMOz2utUr0f44JBXI"
    }

    private val executor = Executors.newSingleThreadExecutor()

    override fun onReceive(context: Context, intent: Intent) {
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        when (intent.action) {
            ACTION_REPLY -> {
                val replyText = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY_TEXT_REPLY)?.toString()
                if (!replyText.isNullOrBlank()) {
                    val sharedPreferences = context.getSharedPreferences("k_messenger_prefs", Context.MODE_PRIVATE)
                    val userId = sharedPreferences.getInt("kmessenger_user_id", -1)
                    if (userId != -1) {
                        executor.execute {
                            sendMessageToSupabase(userId, replyText)
                        }
                    }
                }
                if (notificationId != -1) {
                    notificationManager.cancel(notificationId)
                }
            }

            ACTION_LIKE -> {
                val messageId = intent.getIntExtra(EXTRA_MESSAGE_ID, -1)
                val sharedPreferences = context.getSharedPreferences("k_messenger_prefs", Context.MODE_PRIVATE)
                val userId = sharedPreferences.getInt("kmessenger_user_id", -1)
                if (messageId != -1 && userId != -1) {
                    executor.execute {
                        addLikeReactionToSupabase(messageId, userId)
                    }
                }
                if (notificationId != -1) {
                    notificationManager.cancel(notificationId)
                }
            }

            ACTION_DECLINE_CALL -> {
                if (notificationId != -1) {
                    notificationManager.cancel(notificationId)
                }
            }
        }
    }

    private fun sendMessageToSupabase(senderId: Int, textContent: String) {
        try {
            val url = URL("$SUPABASE_URL/rest/v1/messages")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("apikey", ANON_KEY)
            conn.setRequestProperty("Authorization", "Bearer $ANON_KEY")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Prefer", "return=minimal")
            conn.doOutput = true

            val json = JSONObject().apply {
                put("sender_id", senderId)
                put("text_content", textContent)
                put("reactions", JSONObject())
            }

            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(json.toString())
            writer.flush()
            writer.close()

            conn.responseCode // Execute HTTP request
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun addLikeReactionToSupabase(messageId: Int, userId: Int) {
        try {
            // 1. Fetch current message reactions
            val getUrl = URL("$SUPABASE_URL/rest/v1/messages?id=eq.$messageId&select=reactions")
            val getConn = getUrl.openConnection() as HttpURLConnection
            getConn.requestMethod = "GET"
            getConn.setRequestProperty("apikey", ANON_KEY)
            getConn.setRequestProperty("Authorization", "Bearer $ANON_KEY")

            if (getConn.responseCode == HttpURLConnection.HTTP_OK) {
                val responseStr = getConn.inputStream.bufferedReader().use { it.readText() }
                val jsonArr = org.json.JSONArray(responseStr)
                if (jsonArr.length() > 0) {
                    val currentReactions = jsonArr.getJSONObject(0).optJSONObject("reactions") ?: JSONObject()
                    currentReactions.put(userId.toString(), "❤️")

                    // 2. Patch updated reactions back
                    val patchUrl = URL("$SUPABASE_URL/rest/v1/messages?id=eq.$messageId")
                    val patchConn = patchUrl.openConnection() as HttpURLConnection
                    patchConn.requestMethod = "PATCH"
                    patchConn.setRequestProperty("apikey", ANON_KEY)
                    patchConn.setRequestProperty("Authorization", "Bearer $ANON_KEY")
                    patchConn.setRequestProperty("Content-Type", "application/json")
                    patchConn.doOutput = true

                    val patchJson = JSONObject().apply {
                        put("reactions", currentReactions)
                    }

                    val writer = OutputStreamWriter(patchConn.outputStream)
                    writer.write(patchJson.toString())
                    writer.flush()
                    writer.close()

                    patchConn.responseCode
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
