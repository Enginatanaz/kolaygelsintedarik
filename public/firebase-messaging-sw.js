// TEDARİK360 Web Push & Firebase Cloud Messaging Service Worker
const CACHE_NAME = 'tedarik360-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push / FCM notifications
self.addEventListener('push', (event) => {
  let payload = {
    title: 'TEDARİK360 Operasyon Bildirimi',
    body: 'Yeni bir araç tedarik bildiriminiz var.',
    requestId: '',
    supplierId: '',
    eventType: 'NEW_REQUEST',
    url: '/'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      const notification = parsed.notification || {};
      const data = parsed.data || parsed;
      payload = {
        title: notification.title || data.title || payload.title,
        body: notification.body || data.message || data.body || payload.body,
        requestId: data.requestId || '',
        supplierId: data.supplierId || '',
        eventType: data.eventType || 'NEW_REQUEST',
        url: data.requestId ? `/?requestId=${encodeURIComponent(data.requestId)}` : '/'
      };
    } catch (err) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    tag: payload.requestId ? `tedarik360-${payload.requestId}-${Date.now()}` : `tedarik360-${Date.now()}`,
    renotify: true,
    data: {
      requestId: payload.requestId,
      supplierId: payload.supplierId,
      eventType: payload.eventType,
      url: payload.url
    },
    actions: [
      {
        action: 'open_request',
        title: 'Talebi Görüntüle'
      }
    ]
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Allow client pages to trigger native OS/Phone notification via postMessage
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_LOCAL_PUSH') {
    const { title, body, requestId, supplierId, eventType } = event.data.payload || {};
    const targetUrl = requestId ? `/?requestId=${encodeURIComponent(requestId)}` : '/';
    self.registration.showNotification(title || 'TEDARİK360 Bildirimi', {
      body: body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200],
      tag: `tedarik360-local-${requestId || Date.now()}`,
      data: {
        requestId: requestId || '',
        supplierId: supplierId || '',
        eventType: eventType || 'SYSTEM',
        url: targetUrl
      }
    });
  }
});

// Handle Notification Click -> Open app and navigate to the relevant request screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const requestId = data.requestId || '';
  const targetUrl = data.url || (requestId ? `/?requestId=${encodeURIComponent(requestId)}` : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            requestId,
            eventType: data.eventType || ''
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
