import { getSessionToken } from '../context/AuthContext';
import { NotificationEventPreferences } from '../types';

const DEVICE_TOKEN_STORAGE_KEY = 'tedarik360_fcm_device_token';

function detectDeviceType(): 'ANDROID' | 'IOS' | 'DESKTOP' | 'WEB' {
  if (typeof navigator === 'undefined') return 'WEB';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'ANDROID';
  if (/iphone|ipad|ipod/.test(ua)) return 'IOS';
  if (/windows|macintosh|linux/.test(ua)) return 'DESKTOP';
  return 'WEB';
}

export async function registerServiceWorkerAndPush(options?: {
  requestPermission?: boolean;
}): Promise<{ granted: boolean; fcmToken?: string; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { granted: false, error: 'Tarayıcınız Web Push / Service Worker desteklemiyor.' };
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    if (!('Notification' in window)) {
      return { granted: false, error: 'Bu cihazda bildirim API desteği bulunmuyor.' };
    }

    let permission = Notification.permission;
    if (options?.requestPermission && permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return {
        granted: false,
        error:
          permission === 'denied'
            ? 'Tarayıcı bildirim izni reddedilmiş. Adres çubuğundan bildirimlere izin veriniz.'
            : 'Bildirim izni henüz verilmedi.',
      };
    }

    // Generate or retrieve persistent device push token for this browser/device
    let fcmToken = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
    if (!fcmToken) {
      const randomPart = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      fcmToken = `fcm_${detectDeviceType().toLowerCase()}_${randomPart}`;
      localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, fcmToken);
    }

    const sessionToken = getSessionToken();
    if (sessionToken) {
      await fetch('/api/notifications/device-token/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          fcmToken,
          deviceType: detectDeviceType(),
          userAgent: navigator.userAgent.slice(0, 140),
        }),
      });
    }

    // Keep service worker ready
    await registration.update().catch(() => {});

    return { granted: true, fcmToken };
  } catch (err: any) {
    return { granted: false, error: err.message || 'Push kaydı başarısız.' };
  }
}

export async function unregisterDeviceTokenOnLogout(userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const fcmToken = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
  const sessionToken = getSessionToken();

  if (!fcmToken && !userId) return;

  try {
    await fetch('/api/notifications/device-token/unregister', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ fcmToken, userId }),
    });
  } catch {
    // Ignore network error during signOut
  } finally {
    localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
  }
}

export async function triggerBrowserPushNotification(payload: {
  title: string;
  body: string;
  requestId?: string;
  supplierId?: string;
  eventType?: string;
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'SHOW_LOCAL_PUSH',
          payload,
        });
        return;
      }
    }
    new Notification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192x192.png',
    });
  } catch {
    // Fallback silent if blocked
  }
}

export async function updateSupplierNotificationSettings(params: {
  supplierId?: string;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  mandatoryCriticalPolicy?: boolean;
  eventPreferences?: Partial<NotificationEventPreferences>;
}) {
  const sessionToken = getSessionToken();
  const res = await fetch('/api/notifications/settings/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tercihler güncellenemedi.');
  return data;
}

export async function requestEmailVerification(params: { supplierId?: string; newEmail: string }) {
  const sessionToken = getSessionToken();
  const res = await fetch('/api/notifications/email/request-verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Doğrulama kodu gönderilemedi.');
  return data;
}

export async function verifySupplierEmail(params: {
  supplierId?: string;
  code?: string;
  adminDirectVerify?: boolean;
}) {
  const sessionToken = getSessionToken();
  const res = await fetch('/api/notifications/email/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'E-posta doğrulanamadı.');
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const sessionToken = getSessionToken();
  await fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify({ notificationId }),
  });
}

export async function markAllNotificationsRead() {
  const sessionToken = getSessionToken();
  const res = await fetch('/api/notifications/mark-all-read', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Bildirimler okundu yapılamadı.');
  return data;
}

export async function retryNotificationLog(logId: string) {
  const sessionToken = getSessionToken();
  const res = await fetch('/api/notifications/retry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify({ logId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Yeniden gönderim başarısız.');
  return data;
}

export async function reviseVehicleRequest(params: {
  requestId: string;
  totalQuantity?: number;
  requiredDate?: string;
  requiredTime?: string;
  vehicleType?: string;
  description?: string;
  revisionNote?: string;
  isDeadlineUpdate?: boolean;
}) {
  const sessionToken = getSessionToken();
  const res = await fetch('/api/requests/revise', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Talep revizyonu başarısız.');
  return data;
}

export async function cancelVehicleRequest(params: { requestId: string; cancelReason?: string }) {
  const sessionToken = getSessionToken();
  const res = await fetch('/api/requests/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Talep iptali başarısız.');
  return data;
}
