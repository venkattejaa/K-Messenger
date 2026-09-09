# Keep JavascriptInterface annotations for WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepclassmembers class com.example.k_messenger.WebAppInterface {
    *;
}
