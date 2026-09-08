let swRegistration = null;

// Register Service Worker and Request Notification Permission for Mobile Phones
export async function requestNotificationPermission() {
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Service worker registered successfully:', swRegistration.scope);
    } catch (e) {
      console.warn('[SW] Service worker registration failed:', e);
    }
  }

  if ('Notification' in window && Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      console.log('[NOTIFICATION PERMISSION]:', permission);
    } catch (e) {
      console.warn('Notification permission error:', e);
    }
  }
}

export async function sendBrowserNotification(title, options = {}) {
  try {
    const isCall = options.tag === 'kmessenger_incoming_call';
    const tagStr = options.tag || `kmessenger_msg_${Date.now()}`;
    const bodyStr = options.body || 'New message received';

    // Always trigger physical phone vibration pattern on Android / Mobile devices
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(isCall ? [500, 200, 500, 200, 500] : [300, 100, 300]);
      } catch (e) {}
    }

    // 1. Android Native Bridge (Guaranteed for Android APK app)
    if (window.AndroidNative && typeof window.AndroidNative.showNotification === 'function') {
      try {
        window.AndroidNative.showNotification(title, bodyStr, tagStr, isCall);
        return;
      } catch (e) {
        console.warn('[ANDROID NATIVE NOTIFICATION ERR]:', e);
      }
    }

    // 2. Standard Web Browser Notifications
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notifOptions = {
      icon: options.icon || '/app_icon.png',
      badge: '/app_icon.png',
      vibrate: isCall ? [500, 200, 500, 200, 500] : [300, 100, 300],
      renotify: true,
      tag: tagStr,
      ...options,
    };

    if ('serviceWorker' in navigator) {
      try {
        const reg = swRegistration || (await navigator.serviceWorker.ready);
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notifOptions);
          return;
        }
      } catch (swErr) {
        console.warn('[SW SHOW NOTIFICATION ERR]:', swErr);
      }
    }

    try {
      const notif = new Notification(title, notifOptions);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (err) {
      console.warn('[FALLBACK NOTIFICATION ERR]:', err);
    }
  } catch (e) {
    console.warn('[BROWSER NOTIFICATION ERR]:', e);
  }
}

export function cancelBrowserNotification(tag) {
  try {
    if (window.AndroidNative && typeof window.AndroidNative.cancelNotification === 'function') {
      window.AndroidNative.cancelNotification(tag);
    }
  } catch (e) {}
}
