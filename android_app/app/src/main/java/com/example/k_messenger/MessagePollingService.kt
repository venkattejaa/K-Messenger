package com.example.k_messenger

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class MessagePollingService : Service() {

    companion object {
        var isAppForeground = false
    }

    private val SUPABASE_URL = "https://eccrzzfjljzqmwjcizwj.supabase.co"
    private val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjY3J6emZqbGp6cW13amNpendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTYxNjUsImV4cCI6MjEwNDI5MjE2NX0.goZ1-JPcAUkO9JXVCDjTFPkcxBJMOz2utUr0f44JBXI"
    
    private val POLLING_INTERVAL = 8L
    
    private var scheduler: ScheduledExecutorService? = null
    private lateinit var sharedPreferences: SharedPreferences

    override fun onCreate() {
        super.onCreate()
        sharedPreferences = getSharedPreferences("k_messenger_prefs", Context.MODE_PRIVATE)
        createNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(1, createForegroundNotification())
        
        if (scheduler == null || scheduler?.isShutdown == true) {
            scheduler = Executors.newSingleThreadScheduledExecutor()
            scheduler?.scheduleWithFixedDelay({
                if (!isAppForeground) {
                    pollMessages()
                } else {
                    stopSelf()
                }
            }, 0, POLLING_INTERVAL, TimeUnit.SECONDS)
        }
        
        return START_STICKY
    }

    private fun createForegroundNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            this.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, "kmessenger_bg_messages_channel")
            .setContentTitle("K-Messenger")
            .setContentText("K-Messenger is keeping you connected")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            val msgChannel = NotificationChannel(
                "kmessenger_bg_messages_channel",
                "Background Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "New message notifications when app is in background"
                enableVibration(true)
                vibrationPattern = longArrayOf(200, 100, 200)
            }
            
            val callChannel = NotificationChannel(
                "kmessenger_bg_calls_channel",
                "Background Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming call notifications when app is in background"
                enableVibration(true)
                vibrationPattern = longArrayOf(500, 200, 500, 200, 500)
            }
            
            notificationManager.createNotificationChannel(msgChannel)
            notificationManager.createNotificationChannel(callChannel)
        }
    }

    private fun pollMessages() {
        try {
            val userId = sharedPreferences.getInt("kmessenger_user_id", -1)
            if (userId == -1) return

            val url = URL("$SUPABASE_URL/rest/v1/messages?order=id.desc&limit=10")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("apikey", ANON_KEY)
            connection.setRequestProperty("Authorization", "Bearer $ANON_KEY")

            val responseCode = connection.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val reader = BufferedReader(InputStreamReader(connection.inputStream))
                val response = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    response.append(line)
                }
                reader.close()

                val jsonArray = JSONArray(response.toString())
                processMessages(jsonArray, userId)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun processMessages(messages: JSONArray, userId: Int) {
        val lastSeenId = sharedPreferences.getInt("kmessenger_last_seen_msg_id", -1)
        var newLastSeenId = lastSeenId

        for (i in messages.length() - 1 downTo 0) { // Process oldest to newest
            val msg = messages.getJSONObject(i)
            val id = msg.getInt("id")
            val senderId = msg.getInt("sender_id")
            val textContent = msg.optString("text_content", "")

            if (id > lastSeenId) {
                if (id > newLastSeenId) {
                    newLastSeenId = id
                }

                if (senderId != userId) {
                    handleNewMessage(id, textContent)
                }
            }
        }

        if (newLastSeenId > lastSeenId) {
            sharedPreferences.edit().putInt("kmessenger_last_seen_msg_id", newLastSeenId).apply()
        }
    }

    private fun handleNewMessage(id: Int, textContent: String) {
        if (textContent.startsWith("USER_SETTING:")) return
        if (textContent.startsWith("CALL_SIGNAL:") && !textContent.startsWith("CALL_SIGNAL:offer:")) return
        if (textContent.startsWith("CALL_RECORD:")) return

        val isCall = textContent.startsWith("CALL_SIGNAL:offer:")
        val title = if (isCall) "Incoming Call" else "New Message"
        val body = if (isCall) "Incoming video/audio call" else "You have a new message"
        
        showNotification(id, title, body, isCall)
    }

    private fun showNotification(id: Int, title: String, body: String, isCall: Boolean) {
        val channelId = if (isCall) "kmessenger_bg_calls_channel" else "kmessenger_bg_messages_channel"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(if (isCall) NotificationCompat.CATEGORY_CALL else NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setVibrate(if (isCall) longArrayOf(500, 200, 500, 200, 500) else longArrayOf(200, 100, 200))

        if (isCall) {
            builder.setOngoing(true)
        }

        notificationManager.notify(id, builder.build())
    }

    override fun onDestroy() {
        super.onDestroy()
        scheduler?.shutdownNow()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
