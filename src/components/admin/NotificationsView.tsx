import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Search,
  Truck,
  CheckCheck,
  Mail,
  Smartphone,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  ExternalLink,
  ShieldAlert,
  Filter,
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { NotificationItem, NotificationLog } from '../../types';
import {
  markNotificationRead,
  markAllNotificationsRead,
  retryNotificationLog,
} from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';

interface NotificationsViewProps {
  onNavigateToRequest?: (requestId?: string) => void;
}

const EVENT_LABELS: Record<string, string> = {
  NEW_REQUEST: 'Yeni Araç Talebi',
  REQUEST_REVISION: 'Araç Talebi Revizyonu',
  REQUEST_CANCELLED: 'Araç Talebi İptali',
  NEW_DEADLINE: 'Yeni Termin Bilgisi',
  VEHICLE_APPROVED: 'Araç Onayı',
  VEHICLE_REJECTED: 'Araç Reddi',
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigateToRequest }) => {
  const { userProfile, currentUser } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN';

  const [activeSubTab, setActiveSubTab] = useState<'IN_APP' | 'DELIVERY_LOGS'>('IN_APP');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationLog[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [readFilter, setReadFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'EMAIL' | 'PUSH' | 'IN_APP'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DELIVERED' | 'FAILED' | 'SKIPPED'>('ALL');

  const [previewEmailLog, setPreviewEmailLog] = useState<NotificationLog | null>(null);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // Listen to In-App Notifications & Delivery Logs from notifications collection
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(240));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

        const inAppItems = raw.filter((n) => {
          if (n.isDeliveryLog) return false;
          if (userProfile.role === 'SUPPLIER') {
            return n.supplierId === userProfile.supplierId || n.recipientUserId === currentUser.uid;
          }
          if (userProfile.role === 'OPERATOR') {
            return !n.supplierId && (n.recipientRole === 'OPERATOR' || n.recipientRole === 'ALL');
          }
          return true;
        }) as NotificationItem[];

        setNotifications(inAppItems);

        if (isAdmin) {
          const logs = raw.filter((n) => n.isDeliveryLog === true) as NotificationLog[];
          setDeliveryLogs(logs);
        }
      },
      (err) => console.warn('Notifications fetch error:', err.message)
    );
    return () => unsub();
  }, [currentUser, userProfile, isAdmin]);

  const unreadCount = notifications.filter((n) => !n.read && !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    const isRead = Boolean(n.read || n.isRead);
    if (readFilter === 'UNREAD' && isRead) return false;
    if (readFilter === 'READ' && !isRead) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        (n.title || '').toLowerCase().includes(q) ||
        (n.message || n.body || '').toLowerCase().includes(q) ||
        (n.supplierId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredLogs = deliveryLogs.filter((l) => {
    if (channelFilter !== 'ALL' && l.channel !== channelFilter) return false;
    if (statusFilter === 'DELIVERED' && l.status !== 'DELIVERED' && l.status !== 'SENT') return false;
    if (statusFilter === 'FAILED' && l.status !== 'FAILED') return false;
    if (
      statusFilter === 'SKIPPED' &&
      l.status !== 'SKIPPED_DISABLED' &&
      l.status !== 'SKIPPED_UNVERIFIED_EMAIL'
    )
      return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        (l.supplierName || '').toLowerCase().includes(q) ||
        (l.requestNumber || '').toLowerCase().includes(q) ||
        (l.recipient || '').toLowerCase().includes(q) ||
        (l.eventType || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleRetryLog = async (logId: string) => {
    setRetryingLogId(logId);
    try {
      await retryNotificationLog(logId);
    } catch (err) {
      console.error(err);
    } finally {
      setRetryingLogId(null);
    }
  };

  const getChannelBadge = (channel: NotificationLog['channel']) => {
    if (channel === 'EMAIL') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[11px]">
          <Mail className="w-3.5 h-3.5 text-blue-600" />
          E-Posta
        </span>
      );
    }
    if (channel === 'PUSH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[11px]">
          <Smartphone className="w-3.5 h-3.5 text-purple-600" />
          Web / Telefon Push
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[11px]">
        <Bell className="w-3.5 h-3.5 text-slate-600" />
        Uygulama İçi
      </span>
    );
  };

  const getStatusBadge = (status: NotificationLog['status']) => {
    if (status === 'DELIVERED' || status === 'SENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[10px]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          BAŞARIYLA İLETİLDİ
        </span>
      );
    }
    if (status === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-black text-[10px]">
          <AlertTriangle className="w-3.5 h-3.5" />
          GÖNDERİM HATASI
        </span>
      );
    }
    if (status === 'SKIPPED_UNVERIFIED_EMAIL') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-black text-[10px]">
          <ShieldAlert className="w-3.5 h-3.5" />
          DOĞRULANMAMIŞ E-POSTA (ATLANDI)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px]">
        TERCİH KAPALI (ATLANDI)
      </span>
    );
  };

  // Summary metrics for delivery logs
  const totalEmailsDelivered = deliveryLogs.filter((l) => l.channel === 'EMAIL' && l.status === 'DELIVERED').length;
  const totalPushDelivered = deliveryLogs.filter((l) => l.channel === 'PUSH' && l.status === 'DELIVERED').length;
  const totalInAppDelivered = deliveryLogs.filter((l) => l.channel === 'IN_APP' && l.status === 'DELIVERED').length;
  const totalFailedLogs = deliveryLogs.filter((l) => l.status === 'FAILED').length;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-[#092B60] text-white p-5 rounded-2xl shadow-md border border-[#0D3978] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-[#FFD000] text-[#092B60] rounded-xl shadow-xs">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight">
              Uygulama İçi Bildirim Merkezi & Çok Kanallı Gönderim Takibi
            </h1>
            <p className="text-xs text-blue-200 mt-0.5">
              Tedarikçi izoleli otomatik E-Posta, Telefon Push (FCM) ve Uygulama İçi bildirim geçmişi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFD000] text-[#092B60] font-black text-xs hover:bg-amber-400 transition-all shadow-xs"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Tümünü Okundu Yap ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards (Admin) */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">İletilen Kurumsal E-Posta</div>
              <div className="text-2xl font-black text-[#092B60] font-mono mt-1">{totalEmailsDelivered}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700">
              <Mail className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">İletilen Telefon / Web Push</div>
              <div className="text-2xl font-black text-purple-700 font-mono mt-1">{totalPushDelivered}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">Uygulama İçi Bildirim</div>
              <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{totalInAppDelivered}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
              <Bell className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">Hatalı / Yeniden Denenecek</div>
              <div className="text-2xl font-black text-rose-600 font-mono mt-1">{totalFailedLogs}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      {isAdmin && (
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 w-fit">
          <button
            onClick={() => setActiveSubTab('IN_APP')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
              activeSubTab === 'IN_APP'
                ? 'bg-[#092B60] text-[#FFD000] shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Uygulama İçi Bildirimler ({notifications.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('DELIVERY_LOGS')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
              activeSubTab === 'DELIVERY_LOGS'
                ? 'bg-[#092B60] text-[#FFD000] shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Çok Kanallı Gönderim Durumu & E-Posta Logları ({deliveryLogs.length})</span>
          </button>
        </div>
      )}

      {/* TAB 1: IN-APP NOTIFICATION CENTER */}
      {activeSubTab === 'IN_APP' && (
        <>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Bildirim başlığı, talep no, plaka veya tedarikçi ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#092B60]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {(['ALL', 'UNREAD', 'READ'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setReadFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    readFilter === f
                      ? 'bg-[#092B60] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'ALL' ? 'Tümü' : f === 'UNREAD' ? `Okunmamış (${unreadCount})` : 'Okunmuş'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
            {filteredNotifications.map((n) => {
              const isRead = Boolean(n.read || n.isRead);
              const reqId = n.requestId || n.relatedRequestId;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!isRead) markNotificationRead(n.id);
                    if (reqId && onNavigateToRequest) {
                      onNavigateToRequest(reqId);
                    }
                  }}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                    isRead ? 'bg-white hover:bg-slate-50/80' : 'bg-blue-50/40 hover:bg-blue-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl mt-0.5 ${
                        isRead ? 'bg-slate-100 text-slate-500' : 'bg-[#092B60] text-[#FFD000]'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-black text-xs text-slate-900">{n.title}</span>
                        {n.supplierId && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px]">
                            Tedarikçi: {n.supplierId}
                          </span>
                        )}
                        {!isRead && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white">
                            YENİ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                        {n.message || n.body}
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        {n.createdAt?.seconds && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(n.createdAt.seconds * 1000).toLocaleString('tr-TR')}</span>
                          </div>
                        )}
                        {reqId && onNavigateToRequest && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#092B60] hover:underline">
                            <ExternalLink className="w-3 h-3" />
                            İlgili Talebe Git
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markNotificationRead(n.id);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Okundu İşaretle</span>
                    </button>
                  )}
                </div>
              );
            })}

            {filteredNotifications.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs font-medium">
                Kriterlere uygun bildirim kaydı bulunamadı.
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: MULTI-CHANNEL DELIVERY TRACKING LOGS (ADMIN ONLY) */}
      {isAdmin && activeSubTab === 'DELIVERY_LOGS' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tedarikçi firma, e-posta adresi veya talep no (#REQ) ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#092B60]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-bold">
                <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
                {(['ALL', 'EMAIL', 'PUSH', 'IN_APP'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setChannelFilter(c)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      channelFilter === c ? 'bg-[#092B60] text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c === 'ALL' ? 'Tüm Kanallar' : c === 'EMAIL' ? 'E-Posta' : c === 'PUSH' ? 'Push' : 'Uygulama İçi'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-bold">
                {(['ALL', 'DELIVERED', 'FAILED', 'SKIPPED'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      statusFilter === s ? 'bg-[#092B60] text-white' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s === 'ALL'
                      ? 'Tüm Durumlar'
                      : s === 'DELIVERED'
                      ? 'İletilenler'
                      : s === 'FAILED'
                      ? 'Hatalılar'
                      : 'Atlananlar'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Delivery Tracking Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#092B60] text-white text-[11px] uppercase tracking-wider font-extrabold">
                    <th className="py-3 px-4">Gönderim Zamanı</th>
                    <th className="py-3 px-4">Tedarikçi Firma</th>
                    <th className="py-3 px-4">Olay & Talep No</th>
                    <th className="py-3 px-4">Kanal</th>
                    <th className="py-3 px-4">Alıcı Bilgisi</th>
                    <th className="py-3 px-4">İletim Durumu</th>
                    <th className="py-3 px-4 text-right">İşlem / Önizleme</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {log.createdAt?.seconds
                          ? new Date(log.createdAt.seconds * 1000).toLocaleString('tr-TR')
                          : 'Şimdi'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900">{log.supplierName || log.supplierId}</div>
                        <div className="text-[10px] font-mono text-slate-400">{log.supplierId}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#092B60]">
                          {EVENT_LABELS[log.eventType] || log.eventType}
                        </div>
                        {log.requestNumber && (
                          <span className="inline-block mt-0.5 font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                            #{log.requestNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getChannelBadge(log.channel)}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 max-w-[200px] truncate">
                        {log.recipient || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {getStatusBadge(log.status)}
                          {log.errorMessage && (
                            <div className="text-[10px] text-rose-600 font-semibold max-w-[240px]">
                              Neden: {log.errorMessage}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {log.channel === 'EMAIL' && log.emailHtmlPreview && (
                            <button
                              onClick={() => setPreviewEmailLog(log)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#092B60] font-bold text-[11px] inline-flex items-center gap-1 border border-blue-200"
                              title="Gönderilen Kurumsal E-Posta İçeriğini Gör"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>E-Postayı Gör</span>
                            </button>
                          )}
                          {(log.status === 'FAILED' || log.status === 'SKIPPED_UNVERIFIED_EMAIL') && (
                            <button
                              onClick={() => handleRetryLog(log.id)}
                              disabled={retryingLogId === log.id}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] inline-flex items-center gap-1 border border-amber-300 disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${retryingLogId === log.id ? 'animate-spin' : ''}`}
                              />
                              <span>Yeniden Dene</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        Henüz kayıtlı bildirim gönderim logu bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CORPORATE EMAIL HTML PREVIEW MODAL */}
      {previewEmailLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-[#FFD000]">
                  KURUMSAL E-POSTA ÖNİZLEMESİ (TEDARİKÇİ İZOLELİ)
                </div>
                <div className="text-sm font-bold mt-0.5">
                  {previewEmailLog.emailSubject || 'TEDARİK360 Bildirimi'}
                </div>
                <div className="text-[11px] text-blue-200 font-mono mt-0.5">
                  Alıcı: {previewEmailLog.recipient} • Firma: {previewEmailLog.supplierName}
                </div>
              </div>
              <button
                onClick={() => setPreviewEmailLog(null)}
                className="p-1.5 rounded-lg bg-[#0D3978] text-white hover:bg-blue-800"
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

            <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                Idempotency Key: <code className="font-mono text-slate-700">{previewEmailLog.idempotencyKey}</code>
              </span>
              <button
                onClick={() => setPreviewEmailLog(null)}
                className="px-4 py-2 bg-[#092B60] text-[#FFD000] font-black rounded-xl"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
