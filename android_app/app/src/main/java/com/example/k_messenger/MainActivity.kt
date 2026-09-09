package com.example.k_messenger

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.app.DownloadManager
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

import android.widget.Toast
import android.app.Activity

class WebAppInterface(private val context: Context) {

    @JavascriptInterface
    fun showNotification(title: String, body: String, tag: String, isCall: Boolean) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channelId = if (isCall) "kmessenger_calls_channel" else "kmessenger_messages_channel"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val name = if (isCall) "Incoming Call Alerts" else "Message Notifications"
                val importance = NotificationManager.IMPORTANCE_HIGH
                val channel = NotificationChannel(channelId, name, importance).apply {
                    description = "K-Messenger Notifications"
                    enableVibration(true)
                    vibrationPattern = if (isCall) longArrayOf(500, 200, 500, 200, 500) else longArrayOf(200, 100, 200)
                }
                notificationManager.createNotificationChannel(channel)
            }

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                if (isCall) putExtra("action", "ANSWER_CALL")
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(if (isCall) NotificationCompat.CATEGORY_CALL else NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setVibrate(if (isCall) longArrayOf(500, 200, 500, 200, 500) else longArrayOf(200, 100, 200))

            if (isCall) {
                builder.setOngoing(true)
                builder.setFullScreenIntent(pendingIntent, true)
            }

            val notifId = tag.hashCode()
            notificationManager.notify(notifId, builder.build())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun cancelNotification(tag: String) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(tag.hashCode())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun clearAllNotifications() {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancelAll()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun saveUserId(userId: Int) {
        try {
            val sharedPreferences = context.getSharedPreferences("k_messenger_prefs", Context.MODE_PRIVATE)
            sharedPreferences.edit().putInt("kmessenger_user_id", userId).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun setAudioOutputRoute(route: String) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
            audioManager.mode = android.media.AudioManager.MODE_IN_COMMUNICATION

            when (route.lowercase()) {
                "ear", "earpiece" -> {
                    audioManager.stopBluetoothSco()
                    audioManager.isBluetoothScoOn = false
                    audioManager.isSpeakerphoneOn = false
                }
                "speaker", "loudspeaker" -> {
                    audioManager.stopBluetoothSco()
                    audioManager.isBluetoothScoOn = false
                    audioManager.isSpeakerphoneOn = true
                }
                "bluetooth", "buds", "headset" -> {
                    audioManager.isSpeakerphoneOn = false
                    audioManager.startBluetoothSco()
                    audioManager.isBluetoothScoOn = true
                }
                "normal" -> {
                    audioManager.stopBluetoothSco()
                    audioManager.isBluetoothScoOn = false
                    audioManager.isSpeakerphoneOn = false
                    audioManager.mode = android.media.AudioManager.MODE_NORMAL
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @JavascriptInterface
    fun downloadFile(url: String, fileName: String) {
        try {
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Downloading $fileName to Downloads folder...", Toast.LENGTH_SHORT).show()
            }

            if (url.startsWith("data:")) {
                saveBase64ToDownloads(url, fileName)
                return
            }

            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                setTitle("K-Messenger")
                setDescription("Downloading $fileName...")
                val ext = fileName.substringAfterLast('.', "").lowercase()
                val mime = when (ext) {
                    "png" -> "image/png"
                    "gif" -> "image/gif"
                    "webp" -> "image/webp"
                    "mp4" -> "video/mp4"
                    "mov" -> "video/quicktime"
                    "webm" -> "audio/webm"
                    "mp3" -> "audio/mpeg"
                    "wav" -> "audio/wav"
                    "m4a" -> "audio/m4a"
                    else -> "image/jpeg"
                }
                setMimeType(mime)
                setAllowedOverRoaming(true)
                setAllowedOverMetered(true)
            }
            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
        } catch (e: Exception) {
            e.printStackTrace()
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Download failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun saveBase64ToDownloads(dataUrl: String, fileName: String) {
        try {
            val parts = dataUrl.split(",")
            if (parts.size < 2) return
            val base64Data = parts[1]
            val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)

            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            if (!downloadsDir.exists()) downloadsDir.mkdirs()
            val file = java.io.File(downloadsDir, fileName)
            java.io.FileOutputStream(file).use { out ->
                out.write(bytes)
            }

            android.media.MediaScannerConnection.scanFile(
                context,
                arrayOf(file.absolutePath),
                null,
                null
            )
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Saved to Downloads folder!", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Save failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val APP_URL = "https://frontend-delta-blue-46.vercel.app"

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback != null) {
            val intent = result.data
            var results: Array<Uri>? = null
            if (result.resultCode == RESULT_OK) {
                if (intent != null) {
                    val dataString = intent.dataString
                    val clipData = intent.clipData
                    if (clipData != null) {
                        results = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                    } else if (dataString != null) {
                        results = arrayOf(Uri.parse(dataString))
                    }
                }
            }
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Permissions callback
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupLockScreenFlags()

        webView = WebView(this)
        setContentView(webView)

        setupWebView()
        requestAppPermissions()

        webView.loadUrl(APP_URL)
    }

    private fun setupLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
    }

    private fun setupWebView() {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        webView.addJavascriptInterface(WebAppInterface(this), "AndroidNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    fileChooserLauncher.launch(intent)
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    return false
                }
                return true
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    setTitle(fileName)
                    setDescription("Downloading...")
                    if (mimeType != null) setMimeType(mimeType)
                }
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun requestAppPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.MODIFY_AUDIO_SETTINGS) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.MODIFY_AUDIO_SETTINGS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        MessagePollingService.isAppForeground = true
        stopService(Intent(this, MessagePollingService::class.java))
        try {
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancelAll()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        webView.evaluateJavascript("window.__refetchMessages && window.__refetchMessages()", null)
    }

    override fun onPause() {
        super.onPause()
        MessagePollingService.isAppForeground = false
        val intent = Intent(this, MessagePollingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
