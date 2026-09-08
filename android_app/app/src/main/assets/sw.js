// K-Messenger Service Worker for Mobile Web Push & Native App Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click on Android, iOS & Desktop
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app window is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // If app window is closed, open it in standalone PWA mode
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Background & Local Push Notification Event Listener
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'K-Messenger';
    const options = {
      body: data.body || 'New message received',
      icon: data.icon || '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [300, 100, 300, 100, 300],
      renotify: true,
      tag: data.tag || 'kmessenger_notification',
      data: data,
      actions: [
        { action: 'open', title: 'Open Chat' }
      ]
    };

    if (data.image) {
      options.image = data.image;
    }

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('[SW] Push event error:', e);
  }
});
