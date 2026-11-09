import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  CheckCircle2,
  CheckCheck,
  AlertTriangle,
  ShieldCheck,
  Clock,
  ExternalLink,
  Send,
  Eye,
  X,
  KeyRound,
} from 'lucide-react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Supplier,
  SupplierNotificationSettings,
  NotificationEventPreferences,
  NotificationItem,
  NotificationLog,
  UserDeviceToken,
} from '../../types';
import {
  updateSupplierNotificationSettings,
  requestEmailVerification,
  verifySupplierEmail,
  registerServiceWorkerAndPush,
  triggerBrowserPushNotification,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';

interface SupplierNotificationCenterProps {
  supplierId: string;
  supplier?: Supplier;
  onSelectRequest?: (requestId: string) => void;
}

const DEFAULT_EVENTS: NotificationEventPreferences = {
  NEW_REQUEST: true,
  REQUEST_REVISION: true,
  REQUEST_CANCELLED: true,
  NEW_DEADLINE: true,
  VEHICLE_APPROVED: true,
  VEHICLE_REJECTED: true,
};

export const SupplierNotificationCenter: React.FC<SupplierNotificationCenterProps> = ({
  supplierId,
  supplier,
  onSelectRequest,
}) => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<SupplierNotificationSettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [emailLogs, setEmailLogs] = useState<NotificationLog[]>([]);
  const [deviceTokens, setDeviceTokens] = useState<UserDeviceToken[]>([]);

  // Preferences form state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [eventPrefs, setEventPrefs] = useState<NotificationEventPreferences>(DEFAULT_EVENTS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Email update & verification state
  const [newEmailInput, setNewEmailInput] = useState('');
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [sandboxCodeHint, setSandboxCodeHint] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // Push state
  const [pushLoading, setPushLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewEmailLog, setPreviewEmailLog] = useState<NotificationLog | null>(null);

  // 1. Sync Supplier Notification Settings from live supplier document (Isolated to supplierId)
  useEffect(() => {
    if (!supplier) return;
    const derived: SupplierNotificationSettings = {
      supplierId: supplier.id,
      email: supplier.email || '',
      pendingEmail: supplier.pendingEmail || '',
      emailVerified: supplier.emailVerified !== false,
      emailEnabled: supplier.emailEnabled !== false,
      pushEnabled: supplier.pushEnabled !== false,
      inAppEnabled: supplier.inAppEnabled !== false,
      mandatoryCriticalPolicy: Boolean(supplier.mandatoryCriticalPolicy),
      eventPreferences: { ...DEFAULT_EVENTS, ...(supplier.eventPreferences || {}) },
      updatedAt: supplier.updatedAt,
    };
    setSettings(derived);
    setEmailEnabled(derived.emailEnabled);
    setPushEnabled(derived.pushEnabled);
    setInAppEnabled(derived.inAppEnabled);
    setEventPrefs(derived.eventPreferences);
  }, [supplier]);

  // 2. Listen to In-App Notifications & Email Logs strictly for this supplierId
  useEffect(() => {
    if (!supplierId) return;
    const q = query(collection(db, 'notifications'), where('supplierId', '==', supplierId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
        raw.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const inAppList = raw.filter((r) => !r.isDeliveryLog) as NotificationItem[];
        setNotifications(inAppList);

        const logs = raw.filter((r) => r.isDeliveryLog && r.channel === 'EMAIL' && r.emailHtmlPreview) as NotificationLog[];
        setEmailLogs(logs);
      },
      (err) => console.warn('Supplier notifications fetch notice:', err.message)
    );
    return () => unsub();
  }, [supplierId]);

  // 3. Listen to Registered Device Tokens strictly for current user
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const list = Array.isArray(data.deviceTokens) ? (data.deviceTokens as UserDeviceToken[]) : [];
          setDeviceTokens(list);
        }
      },
      (err) => console.warn('Device tokens fetch notice:', err.message)
    );
    return () => unsub();
  }, [currentUser?.uid]);

  const activeEmail = settings?.email || supplier?.email || '';
  const pendingEmail = settings?.pendingEmail || supplier?.pendingEmail || '';
  const isVerified = (settings?.emailVerified ?? supplier?.emailVerified) !== false;
  const mandatoryPolicy = Boolean(settings?.mandatoryCriticalPolicy ?? supplier?.mandatoryCriticalPolicy);
  const unreadCount = notifications.filter((n) => !n.read && !n.isRead).length;

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setFeedback(null);
    try {
      await updateSupplierNotificationSettings({
        supplierId,
        emailEnabled,
        pushEnabled,
        inAppEnabled,
        eventPreferences: eventPrefs,
      });
      setFeedback({ type: 'success', message: 'Bildirim tercihleriniz başarıyla kaydedildi.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailInput.trim() || !newEmailInput.includes('@')) {
      setFeedback({ type: 'error', message: 'Lütfen geçerli bir kurumsal e-posta adresi giriniz.' });
      return;
    }
    setEmailLoading(true);
    setFeedback(null);
    try {
      const res = await requestEmailVerification({
        supplierId,
        newEmail: newEmailInput.trim(),
      });
      if (res.verificationCodePreview) {
        setSandboxCodeHint(res.verificationCodePreview);
      }
      setFeedback({
        type: 'success',
        message: res.message || 'Doğrulama kodu gönderildi. Lütfen 6 haneli kodu girerek yeni adresinizi doğrulayın.',
      });
      setNewEmailInput('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCodeInput.trim()) return;
    setEmailLoading(true);
    setFeedback(null);
    try {
      const res = await verifySupplierEmail({
        supplierId,
        code: verificationCodeInput.trim(),
      });
      setVerificationCodeInput('');
      setSandboxCodeHint(null);
      setFeedback({
        type: 'success',
        message: res.message || 'Yeni e-posta adresiniz doğrulandı ve aktif bildirim adresi olarak tanımlandı!',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleActivatePush = async () => {
    setPushLoading(true);
    setFeedback(null);
    try {
      const res = await registerServiceWorkerAndPush({ requestPermission: true });
      if (res.granted) {
        await triggerBrowserPushNotification({
          title: 'TEDARİK360 Push Bildirimleri Aktif',
          body: `${supplier?.companyName || supplierId} için telefon ve masaüstü push bildirimleri başarıyla etkinleştirildi.`,
          supplierId,
        });
        setFeedback({
          type: 'success',
          message: 'Bu cihaz için Web / Telefon Push bildirimleri aktifleştirildi ve cihaz token kaydedildi.',
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Push izni alınamadı.' });
      }
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {feedback && (
        <div
          className={`p-4 rounded-xl border font-bold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP GRID: 1. EMAIL VERIFICATION & 2. PHONE PUSH & 3. PREFERENCES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CARD 1: E-POSTA BİLGİLERİ VE DOĞRULAMA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-[#092B60]">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-[#092B60]">Kurumsal E-Posta & Doğrulama</h3>
                <p className="text-[11px] text-slate-500">Doğrulanmamış adres aktif bildirimlerde kullanılmaz</p>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Aktif Bildirim E-Postası</span>
              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                  <CheckCircle2 className="w-3 h-3" />
                  DOĞRULANDI
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                  <AlertTriangle className="w-3 h-3" />
                  ONAY BEKLİYOR
                </span>
              )}
            </div>
            <div className="font-mono font-black text-sm text-[#092B60] break-all">
              {activeEmail || 'Tanımlı e-posta yok'}
            </div>
          </div>

          {pendingEmail && (
            <form
              onSubmit={handleVerifyCode}
              className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2.5"
            >
              <div className="text-[11px] font-bold text-amber-950">
                Doğrulama Bekleyen Yeni E-Posta: <span className="font-mono">{pendingEmail}</span>
              </div>
              <p className="text-[10px] text-amber-800 leading-relaxed">
                Yeni e-posta adresiniz doğrulanana kadar bildirimler mevcut aktif adresinize ({activeEmail}) gönderilmeye devam eder.
              </p>
              {sandboxCodeHint && (
                <div className="p-2 bg-white rounded-lg border border-amber-300 text-[11px] font-mono text-[#092B60]">
                  Doğrulama Kodu: <strong className="font-black text-sm">{sandboxCodeHint}</strong>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6 Haneli Kod"
                  value={verificationCodeInput}
                  onChange={(e) => setVerificationCodeInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-mono font-black text-xs text-center tracking-widest"
                  required
                />
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-[#092B60] text-[#FFD000] font-black text-xs hover:bg-[#0D3978]"
                >
                  Doğrula & Aktifleştir
                </button>
              </div>
            </form>
          )}

          <form onSubmit={handleRequestEmailChange} className="space-y-2 pt-1">
            <label className="block font-bold text-slate-700 text-[11px]">
              E-Posta Adresini Güncelle
            </label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="yeni.operasyon@firmaniz.com"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
                required
              />
              <button
                type="submit"
                disabled={emailLoading}
                className="px-3.5 py-2 rounded-xl bg-[#092B60] hover:bg-[#0D3978] text-white font-bold text-xs shrink-0 inline-flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#FFD000]" />
                <span>Kod Gönder</span>
              </button>
            </div>
          </form>
        </div>

        {/* CARD 2: TELEFON / WEB PUSH & ÇOKLU CİHAZ TOKENLARI */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-[#092B60]">Telefon & Web Push (PWA)</h3>
                <p className="text-[11px] text-slate-500">Android, iOS Ana Ekran ve Masaüstü Chrome</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-black text-[10px]">
              {deviceTokens.length} Aktif Cihaz
            </span>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Push bildirimlerini etkinleştirdiğinizde; yeni araç talebi, revizyon, iptal veya araç onayı geldiğinde telefonunuza ve tarayıcınıza anlık bildirim düşer. Çıkış yaptığınızda cihaz token kaydı otomatik silinir.
          </p>

          <button
            type="button"
            onClick={handleActivatePush}
            disabled={pushLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black text-xs shadow-xs flex items-center justify-center gap-2 transition-all"
          >
            <Smartphone className="w-4 h-4" />
            <span>{pushLoading ? 'Cihaz Kaydediliyor...' : 'Bu Cihazda Push Bildirimlerini Aktifleştir & Test Et'}</span>
          </button>

          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase">
              Kayıtlı Aktif Cihazlarınız (Çoklu Cihaz Desteği)
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1.5">
              {deviceTokens.map((dt) => (
                <div
                  key={dt.id}
                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-black text-[9px]">
                      {dt.deviceType}
                    </span>
                    <span className="font-mono text-slate-600 truncate max-w-[150px]">{dt.fcmToken}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-bold">Aktif</span>
                </div>
              ))}
              {deviceTokens.length === 0 && (
                <div className="p-3 rounded-lg bg-slate-50 text-slate-400 text-center text-[11px]">
                  Henüz kayıtlı push cihazı bulunmuyor.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CARD 3: BİLDİRİM TERCİHLERİ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-[#092B60]">Bildirim Tercihlerim</h3>
                <p className="text-[11px] text-slate-500">Kanal ve olay bazlı bildirim kontrolü</p>
              </div>
            </div>
          </div>

          {mandatoryPolicy && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Yönetici tarafından Zorunlu Kritik Bildirim Politikası etkinleştirilmiştir.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Bildirim Kanalları</div>
            <div className="grid grid-cols-3 gap-2">
              <label className="p-2 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="rounded text-[#092B60]"
                />
                <span className="font-bold text-[11px]">E-Posta</span>
              </label>
              <label className="p-2 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushEnabled}
                  onChange={(e) => setPushEnabled(e.target.checked)}
                  className="rounded text-[#092B60]"
                />
                <span className="font-bold text-[11px]">Push</span>
              </label>
              <label className="p-2 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inAppEnabled}
                  onChange={(e) => setInAppEnabled(e.target.checked)}
                  className="rounded text-[#092B60]"
                />
                <span className="font-bold text-[11px]">Uygulama İçi</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Olay Tercihleri</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: 'NEW_REQUEST', label: 'Yeni Talep' },
                { key: 'REQUEST_REVISION', label: 'Talep Revizyonu' },
                { key: 'REQUEST_CANCELLED', label: 'Talep İptali' },
                { key: 'NEW_DEADLINE', label: 'Yeni Termin' },
                { key: 'VEHICLE_APPROVED', label: 'Araç Onayı' },
                { key: 'VEHICLE_REJECTED', label: 'Araç Reddi' },
              ].map((ev) => (
                <label
                  key={ev.key}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={eventPrefs[ev.key as keyof NotificationEventPreferences] !== false}
                    onChange={(e) =>
                      setEventPrefs((prev) => ({
                        ...prev,
                        [ev.key]: e.target.checked,
                      }))
                    }
                    className="rounded text-[#092B60]"
                  />
                  <span className="font-semibold text-[11px] text-slate-700">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingPrefs}
            className="w-full py-2.5 rounded-xl bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black text-xs shadow-xs"
          >
            {savingPrefs ? 'Kaydediliyor...' : 'Tercihlerimi Kaydet'}
          </button>
        </div>
      </div>

      {/* BOTTOM SECTION: IN-APP NOTIFICATION LIST & CORPORATE EMAIL ARCHIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* In-App Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FFD000]" />
              <h3 className="font-black text-xs">
                Firmanıza Özel Uygulama İçi Bildirimler ({notifications.length})
              </h3>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="px-2.5 py-1 rounded-lg bg-[#FFD000] text-[#092B60] font-black text-[10px] flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Tümünü Okundu Yap ({unreadCount})</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {notifications.map((n) => {
              const isRead = Boolean(n.read || n.isRead);
              const reqId = n.requestId || n.relatedRequestId;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!isRead) markNotificationRead(n.id);
                    if (reqId && onSelectRequest) onSelectRequest(reqId);
                  }}
                  className={`p-3.5 transition-colors cursor-pointer space-y-1 ${
                    isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/50 border-l-4 border-[#092B60]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-[#092B60]">{n.title}</span>
                    {!isRead && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black">
                        OKUNMADI
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{n.message || n.body}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="text-[#092B60] font-bold inline-flex items-center gap-1 hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      İlgili Talebi Aç
                    </span>
                    {n.createdAt?.seconds && (
                      <span className="text-slate-400 font-mono">
                        {new Date(n.createdAt.seconds * 1000).toLocaleString('tr-TR')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {notifications.length === 0 && (
              <div className="p-8 text-center text-slate-400 font-medium">
                Henüz firmanıza ait bildirim bulunmuyor.
              </div>
            )}
          </div>
        </div>

        {/* Sent Corporate Emails Archive for this Supplier */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#FFD000]" />
              <h3 className="font-black text-xs">
                Firmanıza Gönderilen Otomatik Kurumsal E-Postalar ({emailLogs.length})
              </h3>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {emailLogs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 text-xs">{log.emailSubject}</div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Alıcı: {log.recipient} • Durum: {log.status}
                  </div>
                  {log.createdAt?.seconds && (
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.createdAt.seconds * 1000).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setPreviewEmailLog(log)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#092B60] font-bold text-[11px] border border-blue-200 shrink-0 inline-flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Görüntüle</span>
                </button>
              </div>
            ))}

            {emailLogs.length === 0 && (
              <div className="p-8 text-center text-slate-400 font-medium">
                Henüz gönderilmiş kurumsal e-posta kaydı bulunmuyor.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EMAIL PREVIEW MODAL */}
      {previewEmailLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-[#FFD000]">
                  KURUMSAL E-POSTA İÇERİĞİ
                </div>
                <div className="text-sm font-bold mt-0.5">{previewEmailLog.emailSubject}</div>
              </div>
              <button
                onClick={() => setPreviewEmailLog(null)}
                className="p-1.5 rounded-lg bg-[#0D3978] text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
              <div
                className="bg-white rounded-xl overflow-hidden shadow-xs"
                dangerouslySetInnerHTML={{ __html: previewEmailLog.emailHtmlPreview || '' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
