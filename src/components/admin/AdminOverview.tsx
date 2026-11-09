import React, { useState, useMemo } from 'react';
import {
  VehicleRequest,
  RequestAssignment,
  Vehicle,
  Supplier,
  Facility,
  VEHICLE_STATUS_LABELS,
} from '../../types';
import { updateVehicleStatus } from '../../services/logisticsService';
import { useAuth } from '../../context/AuthContext';
import { ExcelExportModal } from './ExcelExportModal';
import {
  FileSpreadsheet,
  Truck,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Plus,
  MapPin,
  Route,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  Check,
  X,
  User,
  Phone,
  Zap,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  BellRing,
} from 'lucide-react';

interface AdminOverviewProps {
  requests: VehicleRequest[];
  assignments: RequestAssignment[];
  vehicles: Vehicle[];
  suppliers: Supplier[];
  facilities: Facility[];
  onNavigateToTab: (tabId: string) => void;
}

// Turkey local time helpers (Europe/Istanbul)
function getTurkeyToday(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function getTurkeyTime(): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '12:00';
  }
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  requests,
  assignments,
  vehicles,
  suppliers,
  facilities,
  onNavigateToTab,
}) => {
  const { currentUser, userProfile } = useAuth();

  const todayStr = useMemo(() => getTurkeyToday(), []);
  const nowTimeStr = useMemo(() => getTurkeyTime(), []);

  // Expanded requests state in the operational tables
  const [expandedRequests, setExpandedRequests] = useState<{ [reqId: string]: boolean }>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const toggleRequestExpand = (id: string) => {
    setExpandedRequests((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper: Request vehicle metrics
  const getRequestStats = (req: VehicleRequest) => {
    const reqVehicles = vehicles.filter(
      (v) => (v.requestId === req.id || v.requestId === req.requestNumber) && !['CANCELLED', 'IPTAL'].includes(v.status)
    );
    const reported = reqVehicles.length;
    const approved = reqVehicles.filter((v) =>
      ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
    const pending = reqVehicles.filter((v) =>
      ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'ARAC_BILDIRILDI', 'YONETICI_ONAYI', 'YANIT_BEKLENIYOR'].includes(v.status)
    ).length;
    const arrived = reqVehicles.filter((v) =>
      ['ARRIVED', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
    const rejected = reqVehicles.filter((v) => v.status === 'REJECTED').length;
    const remaining = Math.max(0, (req.totalQuantity || 0) - approved);
    const isFulfilled = req.status === 'FULFILLED' || (req.totalQuantity > 0 && approved >= req.totalQuantity);
    const isCancelled = req.status === 'CANCELLED';

    // Overdue check
    const isOverdue = req.requiredDate < todayStr && !isFulfilled && !isCancelled;
    const isToday = req.requiredDate === todayStr;

    return {
      vehicles: reqVehicles,
      reported,
      approved,
      pending,
      arrived,
      rejected,
      remaining,
      isFulfilled,
      isCancelled,
      isOverdue,
      isToday,
    };
  };

  // 1. AÇIK ARAÇ TALEPLERİ (Not fulfilled, not cancelled, still needing action)
  const openRequests = useMemo(() => {
    return requests
      .filter((req) => {
        const stats = getRequestStats(req);
        // Completed requests automatically exit open requests
        return !stats.isCancelled && !stats.isFulfilled;
      })
      .sort((a, b) => {
        const statsA = getRequestStats(a);
        const statsB = getRequestStats(b);
        // Overdue first, then today, then upcoming
        if (statsA.isOverdue && !statsB.isOverdue) return -1;
        if (!statsA.isOverdue && statsB.isOverdue) return 1;
        return a.requiredDate.localeCompare(b.requiredDate);
      });
  }, [requests, vehicles, todayStr]);

  // 2. AYNI GÜNÜN ARAÇ TALEPLERİ (Today's requests in Turkey timezone)
  const todayRequests = useMemo(() => {
    return requests
      .filter((req) => {
        const stats = getRequestStats(req);
        return req.requiredDate === todayStr && !stats.isCancelled;
      })
      .sort((a, b) => {
        const statsA = getRequestStats(a);
        const statsB = getRequestStats(b);
        // Missing first, then by requiredTime
        if (statsA.remaining > 0 && statsB.remaining === 0) return -1;
        if (statsA.remaining === 0 && statsB.remaining > 0) return 1;
        const timeA = a.requiredTime || '09:00';
        const timeB = b.requiredTime || '09:00';
        return timeA.localeCompare(timeB);
      });
  }, [requests, vehicles, todayStr]);

  // KPI Calculations
  const totalOpenRequests = openRequests.length;
  const totalTodayRequests = todayRequests.length;

  const totalTodayDemand = useMemo(() => {
    return todayRequests.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
  }, [todayRequests]);

  const totalReportedToday = useMemo(() => {
    return todayRequests.reduce((sum, r) => sum + getRequestStats(r).reported, 0);
  }, [todayRequests, vehicles]);

  const totalApprovedToday = useMemo(() => {
    return todayRequests.reduce((sum, r) => sum + getRequestStats(r).approved, 0);
  }, [todayRequests, vehicles]);

  const totalPendingVehicles = useMemo(() => {
    return vehicles.filter((v) =>
      ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'ARAC_BILDIRILDI', 'YONETICI_ONAYI', 'YANIT_BEKLENIYOR'].includes(v.status)
    ).length;
  }, [vehicles]);

  const totalRemainingDemand = useMemo(() => {
    return openRequests.reduce((sum, r) => sum + getRequestStats(r).remaining, 0);
  }, [openRequests, vehicles]);

  const totalDelayedVehiclesOrRequests = useMemo(() => {
    const delayedVehicles = vehicles.filter((v) => v.status === 'GECIKTI').length;
    const overdueOpenReqs = openRequests.filter((r) => getRequestStats(r).isOverdue).length;
    return delayedVehicles + overdueOpenReqs;
  }, [vehicles, openRequests, todayStr]);

  // 3. GÜNLÜK OPERASYON UYARILARI (Section 2.D)
  const operationalAlerts = useMemo(() => {
    const list: {
      id: string;
      type: 'MISSING' | 'PENDING' | 'APPROACHING' | 'DELAYED' | 'CANCELLED';
      title: string;
      description: string;
      targetTab: string;
    }[] = [];

    // Bugün aracı eksik olan talepler
    todayRequests.forEach((req) => {
      const stats = getRequestStats(req);
      if (stats.remaining > 0) {
        list.push({
          id: `missing-${req.id}`,
          type: 'MISSING',
          title: `Bugün ${stats.remaining} Araç Eksik: ${req.requestNumber}`,
          description: `${req.originFacility} → ${req.destination} (${req.requiredTime || 'Giriş Saati'}) planında henüz ${stats.approved}/${req.totalQuantity} araç onaylandı.`,
          targetTab: 'admin-requests',
        });
      }
    });

    // Onay bekleyen plakalar
    const pendingVehicles = vehicles.filter((v) =>
      ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'ARAC_BILDIRILDI'].includes(v.status)
    );
    if (pendingVehicles.length > 0) {
      list.push({
        id: 'pending-approvals',
        type: 'PENDING',
        title: `${pendingVehicles.length} Araç Yönetici Kontrolü Bekliyor`,
        description: `Tedarikçilerin girdiği ${pendingVehicles.map((v) => v.plate).slice(0, 3).join(', ')}${pendingVehicles.length > 3 ? '...' : ''} plakalı araçlar onay bekliyor.`,
        targetTab: 'admin-requests',
      });
    }

    // Termin geçmiş açık talepler (Acil Müdahale)
    openRequests
      .filter((r) => getRequestStats(r).isOverdue)
      .slice(0, 3)
      .forEach((req) => {
        const stats = getRequestStats(req);
        list.push({
          id: `overdue-${req.id}`,
          type: 'DELAYED',
          title: `Acil Müdahale: Termin Geçti (${req.requestNumber})`,
          description: `Planlanan tarih ${req.requiredDate} idi. ${req.originFacility} → ${req.destination} hattında ${stats.remaining} araç eksik kaldı.`,
          targetTab: 'admin-requests',
        });
      });

    // Geciken veya arızalı araçlar
    const delayedVehs = vehicles.filter((v) => v.status === 'GECIKTI');
    if (delayedVehs.length > 0) {
      list.push({
        id: 'delayed-vehs',
        type: 'DELAYED',
        title: `${delayedVehs.length} Araç Tesise Gecikti`,
        description: `${delayedVehs.map((v) => v.plate).slice(0, 3).join(', ')} plakalı araçlar tahmini varış saatini aştı.`,
        targetTab: 'admin-vehicles',
      });
    }

    return list;
  }, [todayRequests, openRequests, vehicles]);

  // Quick single approval in open request sub-table
  const handleQuickApprove = async (vehicleId: string) => {
    if (!currentUser) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await updateVehicleStatus(
        vehicleId,
        'APPROVED',
        currentUser.uid,
        userProfile?.role || 'ADMIN',
        'Genel Bakış Günlük Operasyon masasından onaylandı'
      );
      setActionFeedback({ type: 'success', message: 'Araç başarıyla onaylandı.' });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Onaylama başarısız.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-xs font-sans">
      {/* Top Banner Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#092B60] tracking-tight">
              Günlük Operasyon Yönetim Merkezi
            </h1>
            <span className="bg-[#FFD000] text-[#092B60] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              CANLI NÖBET
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Türkiye Saati: <strong className="font-mono text-slate-800">{todayStr} • {nowTimeStr}</strong> • Açık talepler, bugünkü seferler ve canlı operasyon takibi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98 shrink-0"
            title="Tüm operasyonel verileri 8 sekmeli Excel (.xlsx) olarak dışa aktar"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Excel'e Aktar</span>
          </button>

          <button
            onClick={() => onNavigateToTab('admin-new-request')}
            className="inline-flex items-center gap-1.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-98 shrink-0"
          >
            <Plus className="w-4 h-4 text-[#FFD000]" />
            <span>Yeni Araç Talebi Aç</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold border transition-all animate-in fade-in flex items-center justify-between ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
              : 'bg-rose-50 text-rose-950 border-rose-300'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button onClick={() => setActionFeedback(null)} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* A. ÜST KPI KARTLARI (Section 2.A: 8 Adet Gerçek Sayı) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Açık Araç Talepleri */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-[#092B60]">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>AÇIK TALEP</span>
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#092B60]" />
          </div>
          <div className="text-xl font-mono font-black text-[#092B60] tracking-tight mt-1">
            {totalOpenRequests}
          </div>
          <div className="text-[9px] text-slate-400 font-medium mt-0.5">İşlem bekleyen</div>
        </div>

        {/* 2. Bugünkü Araç Talepleri */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-[#0D3978]">
          <div className="text-[10px] font-bold text-[#0D3978] uppercase tracking-wider flex items-center justify-between">
            <span>BUGÜNKÜ TALEP</span>
            <Calendar className="w-3.5 h-3.5 text-[#0D3978]" />
          </div>
          <div className="text-xl font-mono font-black text-[#0D3978] tracking-tight mt-1">
            {totalTodayRequests}
          </div>
          <div className="text-[9px] text-slate-400 font-medium mt-0.5">Bugüne planlı</div>
        </div>

        {/* 3. Toplam Bugünkü Araç İhtiyacı */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-blue-600">
          <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center justify-between">
            <span>BUGÜNKÜ İHTİYAÇ</span>
            <Truck className="w-3.5 h-3.5 text-blue-700" />
          </div>
          <div className="text-xl font-mono font-black text-blue-900 tracking-tight mt-1">
            {totalTodayDemand}
          </div>
          <div className="text-[9px] text-slate-400 font-medium mt-0.5">Bugün istenen araç</div>
        </div>

        {/* 4. Bildirilen Araç */}
        <div
          onClick={() => onNavigateToTab('admin-vehicles')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-amber-500 cursor-pointer hover:border-amber-400 transition-all"
        >
          <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center justify-between">
            <span>BİLDİRİLEN</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-mono font-black text-amber-900 tracking-tight mt-1">
            {totalReportedToday}
          </div>
          <div className="text-[9px] text-amber-700 font-medium mt-0.5 truncate">Bugün girilen araç</div>
        </div>

        {/* 5. Onaylanan Araç */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-[#239B70]">
          <div className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider flex items-center justify-between">
            <span>ONAYLANAN</span>
            <CheckCircle className="w-3.5 h-3.5 text-[#239B70]" />
          </div>
          <div className="text-xl font-mono font-black text-[#239B70] tracking-tight mt-1">
            {totalApprovedToday}
          </div>
          <div className="text-[9px] text-emerald-700 font-medium mt-0.5">Kesinleşen sefer</div>
        </div>

        {/* 6. Onay Bekleyen Araç */}
        <div
          onClick={() => onNavigateToTab('admin-requests')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-amber-600 cursor-pointer hover:border-amber-400 transition-all"
        >
          <div className="text-[10px] font-bold text-amber-950 uppercase tracking-wider flex items-center justify-between">
            <span>ONAY BEKLEYEN</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-mono font-black text-amber-800 tracking-tight mt-1">
            {totalPendingVehicles}
          </div>
          <div className="text-[9px] text-amber-700 font-medium mt-0.5">Kontrol bekleyen</div>
        </div>

        {/* 7. Kalan Araç İhtiyacı */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-rose-500">
          <div className="text-[10px] font-bold text-rose-900 uppercase tracking-wider flex items-center justify-between">
            <span>KALAN İHTİYAÇ</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-mono font-black text-rose-700 tracking-tight mt-1">
            {totalRemainingDemand}
          </div>
          <div className="text-[9px] text-rose-600 font-medium mt-0.5">Açık kalan kota</div>
        </div>

        {/* 8. Geciken Araç */}
        <div
          onClick={() => onNavigateToTab('admin-vehicles')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs border-t-4 border-t-rose-700 cursor-pointer hover:border-rose-400 transition-all"
        >
          <div className="text-[10px] font-bold text-rose-950 uppercase tracking-wider flex items-center justify-between">
            <span>GECİKEN</span>
            <Clock className="w-3.5 h-3.5 text-rose-700" />
          </div>
          <div className="text-xl font-mono font-black text-rose-800 tracking-tight mt-1">
            {totalDelayedVehiclesOrRequests}
          </div>
          <div className="text-[9px] text-rose-700 font-medium mt-0.5">Termin aşımı</div>
        </div>
      </div>

      {/* D. GÜNLÜK OPERASYON UYARILARI (Section 2.D) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-[#092B60] text-white flex items-center justify-between border-b border-[#0D3978]">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#FFD000]" />
            <h2 className="font-black text-xs text-white uppercase tracking-wider">
              Günlük Operasyon Uyarıları & Acil Müdahale Masası
            </h2>
          </div>
          <span className="text-[10px] bg-[#FFD000] text-[#092B60] font-mono font-black px-2 py-0.5 rounded-full">
            {operationalAlerts.length} Bildirim
          </span>
        </div>

        {operationalAlerts.length === 0 ? (
          <div className="p-5 text-center text-slate-400 font-medium text-xs">
            Şu an için acil operasyonel uyarı bulunmamaktadır. Tüm günlük seferler planlanan saatlerde ilerlemektedir.
          </div>
        ) : (
          <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
            {operationalAlerts.map((alt) => {
              const isCrit = alt.type === 'DELAYED';
              return (
                <div
                  key={alt.id}
                  onClick={() => onNavigateToTab(alt.targetTab)}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all cursor-pointer ${
                    isCrit
                      ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400'
                      : 'bg-amber-50/60 border-amber-200 hover:border-amber-400'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      isCrit ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {isCrit ? <AlertCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-slate-900 text-xs truncate">{alt.title}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{alt.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* C. AYNI GÜNÜN ARAÇ TALEPLERİ (Section 2.C: İkinci Ana Bölüm) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0D3978]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#FFD000]" />
            <div>
              <h2 className="font-black text-sm text-white font-sans">
                Aynı Günün Araç Talepleri ({todayStr})
              </h2>
              <p className="text-[11px] text-blue-200 mt-0.5">
                Giriş saati yaklaşan, eksik aracı bulunan ve geciken seferler önceliklendirilir
              </p>
            </div>
          </div>
          <span className="text-xs bg-[#FFD000] text-[#092B60] px-3 py-0.5 rounded-full font-mono font-black shadow-2xs">
            {todayRequests.length} Bugünkü Sefer
          </span>
        </div>

        {todayRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-medium text-xs space-y-2">
            <div>Bugün ({todayStr}) için henüz sistemde planlanmış bir araç talebi bulunmuyor.</div>
            <button
              onClick={() => onNavigateToTab('admin-new-request')}
              className="text-[#0D3978] font-bold underline hover:text-[#092B60]"
            >
              Bugüne Yeni Araç Talebi Aç →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
                <tr>
                  <th className="px-4 py-3">Talep No</th>
                  <th className="px-3 py-3">Planlanan Saat</th>
                  <th className="px-3 py-3">Çıkış & Varış</th>
                  <th className="px-4 py-3">Güzergâh Uğrakları</th>
                  <th className="px-3 py-3">Araç Tipi</th>
                  <th className="px-3 py-3 text-center">İhtiyaç</th>
                  <th className="px-3 py-3 text-center">Bildirilen</th>
                  <th className="px-3 py-3 text-center">Onaylanan</th>
                  <th className="px-3 py-3 text-center">Kalan</th>
                  <th className="px-3 py-3 text-center">Güncel Durum</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayRequests.map((req) => {
                  const stats = getRequestStats(req);
                  const isExpanded = !!expandedRequests[req.id];
                  const stops = req.routeStops || [];
                  const hasMissing = stats.remaining > 0;

                  return (
                    <React.Fragment key={req.id}>
                      <tr
                        className={`hover:bg-slate-50/90 transition-colors ${
                          hasMissing ? 'bg-amber-50/20' : ''
                        } ${isExpanded ? 'bg-blue-50/40' : ''}`}
                      >
                        {/* Talep No */}
                        <td className="px-4 py-3 font-mono font-black text-[#092B60]">
                          <span className="bg-[#EAF3FF] px-2 py-0.5 rounded border border-blue-200">
                            {req.requestNumber}
                          </span>
                        </td>

                        {/* Planlanan Saat */}
                        <td className="px-3 py-3 font-mono font-black text-slate-900 text-xs">
                          <div className="flex items-center gap-1 text-[#092B60]">
                            <Clock className="w-3.5 h-3.5 text-[#0D3978]" />
                            <span>{req.requiredTime || '09:00'}</span>
                          </div>
                        </td>

                        {/* Çıkış & Varış */}
                        <td className="px-3 py-3 font-bold text-slate-800">
                          <div className="flex items-center gap-1">
                            <span>{req.originFacility}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-[#0D3978]">{req.destination}</span>
                          </div>
                        </td>

                        {/* Uğrak Noktaları */}
                        <td className="px-4 py-3 max-w-xs">
                          {stops.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {stops.map((st, i) => (
                                <span
                                  key={i}
                                  className="bg-[#FFD000] text-[#092B60] font-black text-[9px] px-1.5 py-0.2 rounded"
                                >
                                  {st.sequence || i + 1}. {st.facilityName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Doğrudan Rota</span>
                          )}
                        </td>

                        {/* Araç Tipi */}
                        <td className="px-3 py-3 text-slate-700">{req.vehicleType}</td>

                        {/* İhtiyaç */}
                        <td className="px-3 py-3 text-center font-mono font-black text-slate-900">
                          {req.totalQuantity}
                        </td>

                        {/* Bildirilen */}
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-800">
                          {stats.reported}
                        </td>

                        {/* Onaylanan */}
                        <td className="px-3 py-3 text-center font-mono font-black text-[#239B70]">
                          {stats.approved}
                        </td>

                        {/* Kalan */}
                        <td className="px-3 py-3 text-center">
                          {stats.remaining > 0 ? (
                            <span className="font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              {stats.remaining} Araç
                            </span>
                          ) : (
                            <span className="text-[#239B70] font-black">0</span>
                          )}
                        </td>

                        {/* Güncel Durum */}
                        <td className="px-3 py-3 text-center">
                          {stats.isFulfilled ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-950 border border-emerald-300">
                              Karşılandı
                            </span>
                          ) : hasMissing ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                              Araç Eksiği Var
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                              İşlemde
                            </span>
                          )}
                        </td>

                        {/* İşlemler */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleRequestExpand(req.id)}
                            className="inline-flex items-center gap-1 bg-[#EAF3FF] hover:bg-[#d8e8fc] text-[#092B60] px-2.5 py-1 rounded-lg font-bold text-[11px] border border-blue-200 transition-colors"
                          >
                            <span>{isExpanded ? 'Kapat' : 'İşlem'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Mini Sub-table for quick approvals */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={11} className="p-3">
                            <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2">
                              <div className="font-bold text-slate-800 text-xs">
                                Bildirilen Araçlar & Hızlı Onay:
                              </div>
                              {stats.vehicles.length === 0 ? (
                                <div className="text-slate-400 text-xs italic">
                                  Bu talep için henüz araç bildirilmedi.
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-100">
                                  {stats.vehicles.map((v) => {
                                    const sup = suppliers.find((s) => s.id === v.supplierId);
                                    const isApproved = ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status);
                                    return (
                                      <div key={v.id} className="py-1.5 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-3">
                                          <span className="font-mono font-black text-[#092B60]">{v.plate}</span>
                                          <span className="font-bold text-slate-700">{sup?.companyName}</span>
                                          <span className="text-slate-500">{v.driverName} ({v.driverPhone})</span>
                                          <span className="font-mono text-slate-400">Giriş: {v.expectedArrival || '09:00'}</span>
                                        </div>
                                        <div>
                                          {!isApproved ? (
                                            <button
                                              onClick={() => handleQuickApprove(v.id)}
                                              disabled={actionLoading}
                                              className="bg-[#239B70] text-white font-bold px-2.5 py-1 rounded-lg text-[10px] hover:bg-emerald-700"
                                            >
                                              Onayla
                                            </button>
                                          ) : (
                                            <span className="text-[#239B70] font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                              Onaylı
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* B. AÇIK ARAÇ TALEPLERİ (Section 2.B: İlk Ana Bölüm) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0D3978]">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-[#FFD000]" />
            <div>
              <h2 className="font-black text-sm text-white font-sans">
                Açık Araç Talepleri (Operasyon Bekleyenler)
              </h2>
              <p className="text-[11px] text-blue-200 mt-0.5">
                Henüz tamamlanmamış ve araç ihtiyacı devam eden tüm aktif talepler listelenir
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#FFD000] text-[#092B60] px-3 py-0.5 rounded-full font-mono font-black shadow-2xs">
              {openRequests.length} Açık Talep
            </span>
            <button
              onClick={() => onNavigateToTab('admin-requests')}
              className="text-xs text-white hover:text-[#FFD000] font-bold underline ml-2"
            >
              Tüm Talepler Masası →
            </button>
          </div>
        </div>

        {openRequests.length === 0 ? (
          <div className="p-10 text-center text-slate-400 font-medium text-xs">
            Şu anda açık araç talebi bulunmuyor. Tüm talepler karşılanmış veya tamamlanmıştır!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
                <tr>
                  <th className="px-4 py-3">Talep No</th>
                  <th className="px-3 py-3">Termin Tarihi & Saat</th>
                  <th className="px-3 py-3">Çıkış Tesisi</th>
                  <th className="px-4 py-3">Güzergâh & Uğraklar</th>
                  <th className="px-3 py-3">Varış Tesisi</th>
                  <th className="px-3 py-3">Araç Tipi</th>
                  <th className="px-3 py-3 text-center">İstenen</th>
                  <th className="px-3 py-3 text-center">Bildirilen</th>
                  <th className="px-3 py-3 text-center">Onaylanan</th>
                  <th className="px-3 py-3 text-center">Kalan</th>
                  <th className="px-3 py-3 text-center">Talep Durumu</th>
                  <th className="px-4 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openRequests.map((req) => {
                  const stats = getRequestStats(req);
                  const isExpanded = !!expandedRequests[req.id];
                  const stops = req.routeStops || [];

                  return (
                    <React.Fragment key={req.id}>
                      <tr
                        className={`hover:bg-slate-50/90 transition-colors ${
                          stats.isOverdue ? 'bg-rose-50/30' : ''
                        } ${isExpanded ? 'bg-blue-50/40' : ''}`}
                      >
                        {/* Talep No */}
                        <td className="px-4 py-3 font-mono font-black text-[#092B60]">
                          <span className="bg-[#EAF3FF] px-2 py-0.5 rounded border border-blue-200">
                            {req.requestNumber}
                          </span>
                        </td>

                        {/* Gerekli Tarih ve Saat */}
                        <td className="px-3 py-3">
                          <div className="font-mono font-bold text-slate-800 text-xs">
                            {req.requiredDate}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {req.requiredTime || '09:00'}
                          </div>
                        </td>

                        {/* Çıkış Tesisi */}
                        <td className="px-3 py-3 font-bold text-slate-900 text-xs">
                          {req.originFacility}
                        </td>

                        {/* Güzergâh & Uğraklar */}
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-center flex-wrap gap-1 text-xs">
                            <span className="font-bold text-slate-700">{req.originFacility}</span>
                            {stops.length > 0 ? (
                              stops.map((st, i) => (
                                <React.Fragment key={i}>
                                  <ArrowRight className="w-3 h-3 text-[#0D3978]" />
                                  <span className="bg-[#FFD000] text-[#092B60] font-black text-[9px] px-1.5 py-0.2 rounded">
                                    {st.sequence || i + 1}. {st.facilityName}
                                  </span>
                                </React.Fragment>
                              ))
                            ) : (
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                            )}
                            <ArrowRight className="w-3 h-3 text-[#0D3978]" />
                            <span className="font-bold text-[#0D3978]">{req.destination}</span>
                          </div>
                        </td>

                        {/* Varış Tesisi */}
                        <td className="px-3 py-3 font-bold text-[#0D3978] text-xs">
                          {req.destination}
                        </td>

                        {/* Araç Tipi */}
                        <td className="px-3 py-3 text-slate-700 text-xs">
                          {req.vehicleType}
                        </td>

                        {/* İstenen Araç */}
                        <td className="px-3 py-3 text-center font-mono font-black text-slate-900 text-sm">
                          {req.totalQuantity}
                        </td>

                        {/* Bildirilen Araç */}
                        <td className="px-3 py-3 text-center font-mono font-bold text-slate-800 text-sm">
                          {stats.reported}
                        </td>

                        {/* Onaylanan Araç */}
                        <td className="px-3 py-3 text-center font-mono font-black text-[#239B70] text-sm">
                          {stats.approved}
                        </td>

                        {/* Kalan İhtiyaç */}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-rose-100 text-rose-900 border border-rose-300">
                            {stats.remaining} Araç
                          </span>
                        </td>

                        {/* Talep Durumu */}
                        <td className="px-3 py-3 text-center">
                          {stats.isOverdue ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white">
                              Gecikmiş
                            </span>
                          ) : stats.isToday ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white">
                              Bugün
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-900">
                              İleri Tarih
                            </span>
                          )}
                        </td>

                        {/* İşlem */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleRequestExpand(req.id)}
                            className="inline-flex items-center gap-1 bg-[#EAF3FF] hover:bg-[#d8e8fc] text-[#092B60] px-2.5 py-1 rounded-lg font-bold text-[11px] border border-blue-200 transition-colors"
                          >
                            <span>{isExpanded ? 'Gizle' : 'İşlemler'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable sub-table */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={12} className="p-4">
                            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-black text-[#092B60] text-xs">
                                  {req.requestNumber} – Tedarikçi Bildirimleri ve Onay Masası
                                </h4>
                                <button
                                  onClick={() => onNavigateToTab('admin-requests')}
                                  className="text-[11px] font-bold text-[#0D3978] hover:underline"
                                >
                                  Detaylı Talep Masasında Aç →
                                </button>
                              </div>

                              {stats.vehicles.length === 0 ? (
                                <div className="text-slate-400 text-xs italic p-2">
                                  Bu talep için henüz tedarikçiler tarafından araç bildirilmedi.
                                </div>
                              ) : (
                                <div className="divide-y divide-slate-100">
                                  {stats.vehicles.map((v) => {
                                    const sup = suppliers.find((s) => s.id === v.supplierId);
                                    const isApproved = ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status);
                                    return (
                                      <div key={v.id} className="py-2 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-3">
                                          <span className="font-mono font-black text-[#092B60]">{v.plate}</span>
                                          <span className="font-bold text-slate-800">{sup?.companyName}</span>
                                          <span className="text-slate-600">{v.driverName} ({v.driverPhone})</span>
                                          <span className="font-mono text-slate-400">Giriş: {v.expectedArrival || '09:00'}</span>
                                        </div>
                                        <div>
                                          {!isApproved ? (
                                            <button
                                              onClick={() => handleQuickApprove(v.id)}
                                              disabled={actionLoading}
                                              className="bg-[#239B70] text-white font-bold px-3 py-1 rounded-lg text-xs hover:bg-emerald-700 shadow-2xs"
                                            >
                                              Aracı Onayla
                                            </button>
                                          ) : (
                                            <span className="text-[#239B70] font-black text-xs bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                                              Onaylandı
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Export Modal */}
      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        requests={requests}
        assignments={assignments}
        vehicles={vehicles}
        suppliers={suppliers}
        facilities={facilities}
      />
    </div>
  );
};
