import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, NotificationItem, Vehicle, VEHICLE_STATUS_LABELS } from '../types';
import {
  Truck,
  ShieldCheck,
  Radio,
  Building2,
  LogOut,
  User,
  Bell,
  BellRing,
  CheckCheck,
  AlertTriangle,
  X,
  ChevronRight,
  Smartphone,
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  markNotificationRead,
  markAllNotificationsRead,
  registerServiceWorkerAndPush,
  triggerBrowserPushNotification,
} from '../services/notificationService';

interface NavbarProps {
  activeTab: string;
  vehicles?: Vehicle[];
  onNavigateToTab?: (tabId: string, requestId?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, vehicles = [], onNavigateToTab }) => {
  const { userProfile, signOut, currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [activeVehicleModal, setActiveVehicleModal] = useState<Vehicle | null>(null);
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);

  // Listen to Service Worker Push Click messages
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        const reqId = event.data.requestId;
        if (onNavigateToTab) {
          if (userProfile?.role === 'SUPPLIER') {
            onNavigateToTab('sup-requests', reqId);
          } else if (userProfile?.role === 'ADMIN') {
            onNavigateToTab('admin-requests', reqId);
          }
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [userProfile?.role, onNavigateToTab]);

  // Firestore Notification Listener with Strict Role & Supplier Isolation
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(60));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as NotificationItem[];

        // STRICT ISOLATION: Suppliers ONLY see their own supplierId notifications (exclude delivery log records)
        const filtered = rawList.filter((n: any) => {
          if (n.isDeliveryLog) return false;
          if (userProfile.role === 'SUPPLIER') {
            return (
              (userProfile.supplierId && n.supplierId === userProfile.supplierId) ||
              n.recipientUserId === currentUser.uid ||
              n.recipientUid === currentUser.uid
            );
          }
          // Admin / Operator sees operational notifications or all
          if (userProfile.role === 'OPERATOR') {
            return !n.supplierId && (n.recipientRole === 'OPERATOR' || n.recipientRole === 'ALL');
          }
          return true;
        });

        // Trigger native Web Push popup for newly arrived unread notifications
        if (initialLoadDoneRef.current) {
          filtered.forEach((n) => {
            const isUnread = !n.read && !n.isRead;
            if (!seenIdsRef.current.has(n.id) && isUnread) {
              triggerBrowserPushNotification({
                title: n.title,
                body: n.message || n.body,
                requestId: n.requestId || n.relatedRequestId || '',
                supplierId: n.supplierId || '',
                eventType: n.type,
              });
            }
          });
        }

        filtered.forEach((n) => seenIdsRef.current.add(n.id));
        initialLoadDoneRef.current = true;
        setNotifications(filtered.slice(0, 30));
      },
      (err) => console.warn('Notif fetch error:', err.message)
    );
    return () => unsub();
  }, [currentUser, userProfile]);

  const unreadCount = notifications.filter((n) => !n.read && !n.isRead).length;

  const handleEnablePush = async () => {
    const res = await registerServiceWorkerAndPush({ requestPermission: true });
    if (res.granted) {
      setPushGranted(true);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.read && !n.isRead) {
      markNotificationRead(n.id);
    }

    if (n.relatedVehicleId) {
      const found = vehicles.find((v) => v.id === n.relatedVehicleId);
      if (found) {
        setActiveVehicleModal(found);
        setShowNotifDropdown(false);
        return;
      }
    }

    const targetReqId = n.requestId || n.relatedRequestId;
    if (onNavigateToTab) {
      if (userProfile?.role === 'SUPPLIER') {
        onNavigateToTab('sup-requests', targetReqId || undefined);
      } else if (userProfile?.role === 'ADMIN') {
        onNavigateToTab(targetReqId ? 'admin-requests' : 'admin-notifications', targetReqId || undefined);
      }
      setShowNotifDropdown(false);
    }
  };

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFD000] text-[#092B60] shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            Sistem Yöneticisi (Admin)
          </span>
        );
      case 'OPERATOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAF3FF] text-[#092B60] border border-[#0D3978]/30">
            <Radio className="w-3.5 h-3.5 text-[#092B60]" />
            Lojistik Operatörü
          </span>
        );
      case 'SUPPLIER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFD000]/20 text-[#FFD000] border border-[#FFD000]/50">
            <Building2 className="w-3.5 h-3.5" />
            Tedarikçi ({userProfile?.fullName || userProfile?.supplierId})
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <header className="h-16 bg-[#092B60] text-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-md border-b border-[#0D3978]/70">
        {/* Brand & Context */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFD000] text-[#092B60] flex items-center justify-center shadow-md font-black">
              <Truck className="w-5 h-5 text-[#092B60]" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-black tracking-tight text-white font-sans">TEDARİK</span>
                <span className="text-xl font-black tracking-tight text-[#FFD000] font-sans">360</span>
              </div>
              <span className="hidden sm:block text-[11px] font-medium text-blue-200">
                Araç Tedarik & Operasyon Yönetim Platformu
              </span>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Role Badge */}
          <div className="hidden md:block">{getRoleBadge(userProfile?.role)}</div>

          {/* System Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="p-2.5 rounded-xl bg-[#0D3978]/90 hover:bg-[#0D3978] text-blue-200 hover:text-white transition-all relative border border-blue-700/40"
              title="Uygulama İçi Bildirim Merkezi"
            >
              {unreadCount > 0 ? (
                <BellRing className="w-4 h-4 text-[#FFD000] animate-bounce" />
              ) : (
                <Bell className="w-4 h-4 text-[#FFD000]" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono font-black text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-[#092B60]">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {showNotifDropdown && (
              <div className="absolute right-0 mt-3 w-80 sm:w-[410px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 text-slate-800 text-xs overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3.5 bg-[#092B60] text-white flex items-center justify-between border-b border-[#0D3978]">
                  <div className="font-bold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#FFD000]" />
                    <span className="font-sans font-bold text-sm">Bildirim Merkezi</span>
                    {unreadCount > 0 && (
                      <span className="bg-[#FFD000] text-[#092B60] font-mono font-black px-1.5 py-0.5 rounded text-[10px]">
                        {unreadCount} Yeni
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="px-2 py-1 rounded-lg bg-[#0D3978] hover:bg-blue-800 text-[#FFD000] font-bold text-[10px] flex items-center gap-1 transition-colors"
                        title="Tümünü Okundu Yap"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Tümünü Okundu Yap</span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifDropdown(false)}
                      className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-[#0D3978]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Push status bar */}
                {!pushGranted && (
                  <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                      <Smartphone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Telefon / Tarayıcı Push bildirimlerini açın</span>
                    </div>
                    <button
                      onClick={handleEnablePush}
                      className="px-2.5 py-1 bg-[#092B60] text-[#FFD000] font-black text-[10px] rounded-lg shrink-0 hover:bg-[#0D3978]"
                    >
                      Aktifleştir
                    </button>
                  </div>
                )}

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.map((n) => {
                    const isRead = Boolean(n.read || n.isRead);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 transition-all cursor-pointer space-y-1 ${
                          isRead
                            ? 'bg-slate-50/60 opacity-75 hover:bg-slate-100/80'
                            : 'bg-blue-50/60 hover:bg-blue-50 border-l-4 border-[#092B60]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#092B60] text-xs">{n.title}</span>
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
                          )}
                        </div>
                        <p className="text-slate-600 text-[11px] whitespace-pre-line leading-relaxed">
                          {n.message || n.body}
                        </p>
                        <div className="text-[10px] text-[#092B60] font-bold pt-1 flex items-center justify-between">
                          <span className="flex items-center gap-0.5 hover:underline">
                            <span>{n.relatedVehicleId ? 'Araç Detayını Gör' : 'İlgili Talebe Git'}</span>
                            <ChevronRight className="w-3 h-3 text-[#092B60]" />
                          </span>
                          {n.createdAt?.seconds && (
                            <span className="text-slate-400 font-mono">
                              {new Date(n.createdAt.seconds * 1000).toLocaleTimeString('tr-TR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {notifications.length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-medium">
                      Henüz yeni bildirim bulunmuyor.
                    </div>
                  )}
                </div>

                {onNavigateToTab && (
                  <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                    <button
                      onClick={() => {
                        setShowNotifDropdown(false);
                        if (userProfile?.role === 'SUPPLIER') {
                          onNavigateToTab('sup-notifications');
                        } else if (userProfile?.role === 'ADMIN') {
                          onNavigateToTab('admin-notifications');
                        }
                      }}
                      className="w-full py-1.5 text-center font-bold text-[#092B60] hover:bg-blue-50 rounded-lg transition-colors text-[11px]"
                    >
                      Tüm Bildirim Geçmişi & Tercihleri Aç →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-3 pl-3 border-l border-blue-800/60">
            <div className="w-9 h-9 rounded-full bg-[#0D3978] border border-[#FFD000]/40 flex items-center justify-center text-[#FFD000] font-black shadow-2xs">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white leading-tight">
                {userProfile?.fullName || 'Kullanıcı'}
              </div>
              <div className="text-[11px] font-mono text-blue-200">
                @{userProfile?.username || userProfile?.email?.split('@')[0]}
              </div>
            </div>

            <button
              onClick={() => signOut()}
              title="Güvenli Çıkış Yap"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#FFD000] hover:bg-[#0D3978] border border-[#FFD000]/40 rounded-xl transition-all ml-1"
            >
              <LogOut className="w-3.5 h-3.5 text-[#FFD000]" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      {/* MODAL: NOTIFICATION CLICKED -> VEHICLE DETAIL MODAL */}
      {activeVehicleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs space-y-4 border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#092B60] text-[#FFD000] rounded-xl shadow-xs">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#092B60]">
                    Araç Sefer Detayı ({activeVehicleModal.plate})
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Talep ID: {activeVehicleModal.requestId}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveVehicleModal(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-[#EAF3FF] rounded-xl border border-blue-200/80 flex items-center justify-between">
                <div>
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">PLAKA & TİP</div>
                  <div className="font-mono font-black text-lg text-[#092B60] tracking-tight">
                    {activeVehicleModal.plate}
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">{activeVehicleModal.vehicleType}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">MEVCUT DURUM</div>
                  <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold bg-[#092B60] text-white shadow-2xs">
                    {VEHICLE_STATUS_LABELS[activeVehicleModal.status]?.label || activeVehicleModal.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Şoför Adı:</span>
                  <strong className="text-slate-900 font-bold text-xs">{activeVehicleModal.driverName}</strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Telefon:</span>
                  <strong className="text-slate-900 font-mono text-xs">{activeVehicleModal.driverPhone}</strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold block text-[10px] uppercase">Güzergâh:</span>
                <strong className="text-[#092B60] font-black text-xs">
                  {activeVehicleModal.originFacility} → {activeVehicleModal.destination}
                </strong>
                {activeVehicleModal.routeStops && activeVehicleModal.routeStops.length > 0 && (
                  <div className="mt-1 text-[11px] text-slate-600 font-medium">
                    Uğraklar: {activeVehicleModal.routeStops.map((s) => s.facilityName).join(' → ')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Tahmini Giriş:</span>
                  <strong className="text-slate-900 font-mono text-xs">
                    {activeVehicleModal.requiredDate} {activeVehicleModal.expectedArrival || '09:00'}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Tedarikçi:</span>
                  <strong className="text-slate-900 font-bold uppercase text-xs">{activeVehicleModal.supplierId}</strong>
                </div>
              </div>

              {(activeVehicleModal.revisionCount || 0) > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Bu araç bilgisi {activeVehicleModal.revisionCount} kez revize edilmiştir.</span>
                </div>
              )}

              {activeVehicleModal.description && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Açıklama:</span>
                  <p className="text-slate-700 text-xs mt-0.5 leading-relaxed">{activeVehicleModal.description}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveVehicleModal(null)}
                className="px-5 py-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl shadow-md transition-all active:scale-98"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
