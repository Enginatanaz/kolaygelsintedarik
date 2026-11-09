import React, { useState, useMemo } from 'react';
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
  Search,
  Check,
  X,
  History,
  User,
  Phone,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  VehicleRequest,
  RequestAssignment,
  Vehicle,
  Supplier,
  Facility,
  VEHICLE_STATUS_LABELS,
} from '../../types';
import { updateVehicleStatus } from '../../services/logisticsService';
import { reviseVehicleRequest, cancelVehicleRequest } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';
import { ExcelExportModal } from './ExcelExportModal';

interface VehicleRequestsViewProps {
  requests: VehicleRequest[];
  assignments: RequestAssignment[];
  vehicles: Vehicle[];
  suppliers: Supplier[];
  facilities: Facility[];
  onNavigateToTab: (tabId: string) => void;
}

export const VehicleRequestsView: React.FC<VehicleRequestsViewProps> = ({
  requests,
  assignments,
  vehicles,
  suppliers,
  facilities,
  onNavigateToTab,
}) => {
  const { currentUser, userProfile } = useAuth();

  // Expandable Request rows state (stores set of expanded request IDs)
  const [expandedRequests, setExpandedRequests] = useState<{ [reqId: string]: boolean }>({});

  // Filter and Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('ALL');
  const [destinationFilter, setDestinationFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [pendingOnlyFilter, setPendingOnlyFilter] = useState(false);
  const [missingOnlyFilter, setMissingOnlyFilter] = useState(false);

  // Multi-vehicle selection state for bulk approval
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<{ [vehicleId: string]: boolean }>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Revision modal state
  const [revisionModalVehicle, setRevisionModalVehicle] = useState<Vehicle | null>(null);

  // Rejection modal state
  const [rejectModalVehicle, setRejectModalVehicle] = useState<Vehicle | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Request Revision / Deadline Update & Cancellation modals
  const [reviseModalReq, setReviseModalReq] = useState<VehicleRequest | null>(null);
  const [reviseDate, setReviseDate] = useState('');
  const [reviseTime, setReviseTime] = useState('');
  const [reviseQty, setReviseQty] = useState<number>(1);
  const [reviseDescription, setReviseDescription] = useState('');
  const [reviseNote, setReviseNote] = useState('');
  const [isDeadlineOnly, setIsDeadlineOnly] = useState(false);

  const [cancelModalReq, setCancelModalReq] = useState<VehicleRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const handleOpenReviseModal = (req: VehicleRequest, deadlineOnly = false) => {
    setReviseModalReq(req);
    setReviseDate(req.requiredDate || '');
    setReviseTime(req.requiredTime || '09:00');
    setReviseQty(req.totalQuantity || 1);
    setReviseDescription(req.description || '');
    setReviseNote('');
    setIsDeadlineOnly(deadlineOnly);
  };

  const handleConfirmReviseRequest = async () => {
    if (!reviseModalReq) return;
    setActionLoading(true);
    try {
      await reviseVehicleRequest({
        requestId: reviseModalReq.id,
        requiredDate: reviseDate,
        requiredTime: reviseTime,
        totalQuantity: reviseQty,
        description: reviseDescription,
        revisionNote: reviseNote || (isDeadlineOnly ? 'Termin tarihi/saati güncellendi.' : 'Talep detayları revize edildi.'),
        isDeadlineUpdate: isDeadlineOnly,
      });
      setActionFeedback({
        type: 'success',
        message: isDeadlineOnly
          ? `${reviseModalReq.requestNumber} talebinin termin bilgisi güncellendi ve ilgili tedarikçilere bildirim gönderildi.`
          : `${reviseModalReq.requestNumber} talebi revize edildi ve ilgili tedarikçilere bildirim gönderildi.`,
      });
      setReviseModalReq(null);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Talep güncellenirken hata oluştu.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancelRequest = async () => {
    if (!cancelModalReq) return;
    setActionLoading(true);
    try {
      await cancelVehicleRequest({
        requestId: cancelModalReq.id,
        cancelReason: cancelReason || 'Operasyonel plan değişikliği nedeniyle talep iptal edildi.',
      });
      setActionFeedback({
        type: 'success',
        message: `${cancelModalReq.requestNumber} talebi iptal edildi ve ilgili tedarikçilere otomatik bildirim gönderildi.`,
      });
      setCancelModalReq(null);
      setCancelReason('');
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Talep iptal edilirken hata oluştu.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRequestExpand = (id: string) => {
    setExpandedRequests((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // KPI Calculations
  const totalRequestsCount = requests.length;

  const totalVehicleDemand = useMemo(() => {
    return requests.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
  }, [requests]);

  const totalReportedVehicles = useMemo(() => {
    return vehicles.filter((v) =>
      ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'APPROVED', 'ON_THE_WAY', 'ARRIVED', 'ARAC_BILDIRILDI', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
  }, [vehicles]);

  const totalApprovedVehicles = useMemo(() => {
    return vehicles.filter((v) =>
      ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
  }, [vehicles]);

  const totalRemainingDemand = useMemo(() => {
    return Math.max(0, totalVehicleDemand - totalApprovedVehicles);
  }, [totalVehicleDemand, totalApprovedVehicles]);

  const uniqueVehicleTypes = useMemo(() => {
    const types = new Set<string>();
    requests.forEach((r) => {
      if (r.vehicleType) types.add(r.vehicleType);
    });
    return Array.from(types);
  }, [requests]);

  // Request-level metrics helper
  const getRequestMetrics = (req: VehicleRequest) => {
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
    const rejected = reqVehicles.filter((v) => v.status === 'REJECTED').length;
    const remaining = Math.max(0, (req.totalQuantity || 0) - approved);

    return {
      vehicles: reqVehicles,
      reported,
      approved,
      pending,
      rejected,
      remaining,
    };
  };

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const metrics = getRequestMetrics(req);

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesNo = req.requestNumber?.toLowerCase().includes(query);
        const matchesOrigin = req.originFacility?.toLowerCase().includes(query);
        const matchesDest = req.destination?.toLowerCase().includes(query);
        const matchesStops = req.routeStops?.some((s) => s.facilityName.toLowerCase().includes(query));
        if (!matchesNo && !matchesOrigin && !matchesDest && !matchesStops) {
          return false;
        }
      }

      if (originFilter !== 'ALL' && req.originFacility !== originFilter) return false;
      if (destinationFilter !== 'ALL' && req.destination !== destinationFilter) return false;
      if (vehicleTypeFilter !== 'ALL' && req.vehicleType !== vehicleTypeFilter) return false;
      if (dateFilter && req.requiredDate !== dateFilter) return false;

      if (supplierFilter !== 'ALL') {
        const hasAssignment = assignments.some(
          (a) => a.requestId === req.id && a.supplierId === supplierFilter
        );
        const hasVehicle = metrics.vehicles.some((v) => v.supplierId === supplierFilter);
        if (!hasAssignment && !hasVehicle) return false;
      }

      if (pendingOnlyFilter && metrics.pending === 0) return false;
      if (missingOnlyFilter && metrics.remaining === 0) return false;

      return true;
    });
  }, [
    requests,
    vehicles,
    assignments,
    searchTerm,
    originFilter,
    destinationFilter,
    vehicleTypeFilter,
    dateFilter,
    supplierFilter,
    pendingOnlyFilter,
    missingOnlyFilter,
  ]);

  const hasActiveFilters =
    searchTerm !== '' ||
    originFilter !== 'ALL' ||
    destinationFilter !== 'ALL' ||
    supplierFilter !== 'ALL' ||
    vehicleTypeFilter !== 'ALL' ||
    dateFilter !== '' ||
    pendingOnlyFilter ||
    missingOnlyFilter;

  const resetFilters = () => {
    setSearchTerm('');
    setOriginFilter('ALL');
    setDestinationFilter('ALL');
    setSupplierFilter('ALL');
    setVehicleTypeFilter('ALL');
    setDateFilter('');
    setPendingOnlyFilter(false);
    setMissingOnlyFilter(false);
  };

  // DIRECT VEHICLE ACTIONS
  const handleSingleApprove = async (vehicleId: string) => {
    if (!currentUser) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await updateVehicleStatus(
        vehicleId,
        'APPROVED',
        currentUser.uid,
        userProfile?.role || 'ADMIN',
        'Yönetici tarafından talep tablosundan doğrudan onaylandı'
      );
      setActionFeedback({ type: 'success', message: 'Araç başarıyla onaylandı.' });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Araç onaylanamadı.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!currentUser || !rejectModalVehicle) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await updateVehicleStatus(
        rejectModalVehicle.id,
        'REJECTED',
        currentUser.uid,
        userProfile?.role || 'ADMIN',
        rejectReason || 'Yönetici tarafından reddedildi'
      );
      setActionFeedback({ type: 'success', message: `${rejectModalVehicle.plate} plakalı araç reddedildi.` });
      setRejectModalVehicle(null);
      setRejectReason('');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Araç reddedilemedi.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSelectVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((prev) => ({
      ...prev,
      [vehicleId]: !prev[vehicleId],
    }));
  };

  const handleSelectAllPendingForRequest = (reqVehicles: Vehicle[]) => {
    const pendingVehicles = reqVehicles.filter((v) =>
      ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'ARAC_BILDIRILDI', 'YONETICI_ONAYI', 'YANIT_BEKLENIYOR'].includes(v.status)
    );
    const allSelected = pendingVehicles.every((v) => selectedVehicleIds[v.id]);

    setSelectedVehicleIds((prev) => {
      const next = { ...prev };
      pendingVehicles.forEach((v) => {
        if (allSelected) {
          delete next[v.id];
        } else {
          next[v.id] = true;
        }
      });
      return next;
    });
  };

  const handleBatchApprove = async () => {
    if (!currentUser) return;
    const targetIds = Object.keys(selectedVehicleIds).filter((id) => selectedVehicleIds[id]);
    if (targetIds.length === 0) return;

    setActionLoading(true);
    setActionFeedback(null);
    try {
      await Promise.all(
        targetIds.map((id) =>
          updateVehicleStatus(
            id,
            'APPROVED',
            currentUser.uid,
            userProfile?.role || 'ADMIN',
            'Toplu yönetici onayı yapıldı'
          )
        )
      );
      setSelectedVehicleIds({});
      setActionFeedback({
        type: 'success',
        message: `${targetIds.length} adet araç başarıyla toplu olarak onaylandı.`,
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Toplu onaylama sırasında hata oluştu.' });
    } finally {
      setActionLoading(false);
    }
  };

  const selectedCount = Object.values(selectedVehicleIds).filter(Boolean).length;

  return (
    <div className="space-y-5 text-xs font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#092B60] tracking-tight">Araç Talepleri & Kontenjan Masası</h1>
            <span className="bg-[#FFD000] text-[#092B60] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              CANLI TALEPLER
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Uğraklı rotalar, tedarikçi araç bildirimleri, doğrudan yönetici onayı ve kontenjan takibi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98 shrink-0"
            title="Tüm araç taleplerini ve operasyon verilerini 8 sekmeli Excel (.xlsx) olarak dışa aktar"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Excel'e Aktar</span>
          </button>

          <button
            onClick={() => onNavigateToTab('admin-new-request')}
            className="inline-flex items-center gap-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-98 shrink-0"
          >
            <Plus className="w-4 h-4 text-[#FFD000]" />
            <span>Yeni Uğraklı Araç Talebi Aç</span>
          </button>
        </div>
      </div>

      {/* 5 Kompakt KPI Kartı */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#092B60]">
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>TOPLAM TALEP</span>
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#092B60]" />
          </div>
          <div className="text-2xl font-mono font-black text-[#092B60] tracking-tight mt-1">
            {totalRequestsCount}
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Aktif lojistik talebi</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#0D3978]">
          <div className="text-[#0D3978] text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>TOPLAM İHTİYAÇ</span>
            <Truck className="w-3.5 h-3.5 text-[#0D3978]" />
          </div>
          <div className="text-2xl font-mono font-black text-[#0D3978] tracking-tight mt-1">
            {totalVehicleDemand}
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Planlanan toplam sefer</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-amber-500">
          <div className="text-amber-900 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>BİLDİRİLEN ARAÇ</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-mono font-black text-amber-900 tracking-tight mt-1">
            {totalReportedVehicles}
          </div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">Tedarikçi girişleri</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#239B70]">
          <div className="text-emerald-950 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>ONAYLANAN ARAÇ</span>
            <CheckCircle className="w-3.5 h-3.5 text-[#239B70]" />
          </div>
          <div className="text-2xl font-mono font-black text-[#239B70] tracking-tight mt-1">
            {totalApprovedVehicles}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Yönetici tarafından onaylı</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-rose-500 col-span-2 sm:col-span-1">
          <div className="text-rose-900 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>KALAN İHTİYAÇ</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-2xl font-mono font-black text-rose-700 tracking-tight mt-1">
            {totalRemainingDemand}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">Temin bekleyen açık kota</div>
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
          <button
            onClick={() => setActionFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filtre ve Arama Alanı */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Talep no, çıkış tesisi, varış tesisi veya uğrak ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#092B60] text-xs font-bold placeholder:font-normal placeholder:text-slate-400"
            />
          </div>

          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800 text-xs bg-white w-full md:w-auto"
          >
            <option value="ALL">Çıkış: Tümü</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.facilityName}>
                {f.facilityName}
              </option>
            ))}
          </select>

          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800 text-xs bg-white w-full md:w-auto"
          >
            <option value="ALL">Varış: Tümü</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.facilityName}>
                {f.facilityName}
              </option>
            ))}
          </select>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800 text-xs bg-white w-full md:w-auto"
          >
            <option value="ALL">Tedarikçi: Tümü (4 Firma)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.companyName}
              </option>
            ))}
          </select>

          <select
            value={vehicleTypeFilter}
            onChange={(e) => setVehicleTypeFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800 text-xs bg-white w-full md:w-auto"
          >
            <option value="ALL">Araç Tipi: Tümü</option>
            {uniqueVehicleTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600">Tarih:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none"
              />
              {dateFilter && (
                <button onClick={() => setDateFilter('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setPendingOnlyFilter(!pendingOnlyFilter)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors border ${
                pendingOnlyFilter
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              ⏳ Sadece Onay Bekleyenler
            </button>

            <button
              onClick={() => setMissingOnlyFilter(!missingOnlyFilter)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors border ${
                missingOnlyFilter
                  ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              ⚠️ Eksik Araç Bulunanlar
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Filtreleri Sıfırla</span>
            </button>
          )}
        </div>
      </div>

      {/* Yatay ve Kompakt Araç Talep Tablosu */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0D3978]">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-[#FFD000]" />
            <h2 className="font-black text-sm text-white font-sans">
              Güncel Uğraklı Araç Talepleri & Kontenjan Tablosu
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#FFD000] text-[#092B60] px-3 py-0.5 rounded-full font-mono font-black shadow-2xs">
              {filteredRequests.length} / {requests.length} Talep
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
              <tr>
                <th className="px-4 py-3">Talep No</th>
                <th className="px-3 py-3">Çıkış Tesisi</th>
                <th className="px-4 py-3">Güzergâh & Uğraklar</th>
                <th className="px-3 py-3">Varış Tesisi</th>
                <th className="px-3 py-3">Araç Tipi</th>
                <th className="px-3 py-3 text-center">Talep Edilen</th>
                <th className="px-3 py-3 text-center">Bildirilen</th>
                <th className="px-3 py-3 text-center">Onaylanan</th>
                <th className="px-3 py-3 text-center">Kalan İhtiyaç</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => {
                const metrics = getRequestMetrics(req);
                const isExpanded = !!expandedRequests[req.id];
                const stops = req.routeStops || [];

                return (
                  <React.Fragment key={req.id}>
                    <tr
                      className={`hover:bg-slate-50/90 transition-colors ${
                        isExpanded ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="font-mono font-black text-[#092B60] text-xs bg-[#EAF3FF] px-2.5 py-1 rounded-lg border border-blue-200 inline-block">
                          {req.requestNumber}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {req.requiredDate} {req.requiredTime || ''}
                        </div>
                      </td>

                      <td className="px-3 py-3 align-middle">
                        <div className="font-bold text-slate-900 flex items-center gap-1 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-[#092B60] shrink-0" />
                          <span>{req.originFacility}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-middle max-w-sm">
                        <div className="flex items-center flex-wrap gap-1.5 text-xs">
                          <span className="font-bold text-slate-800">{req.originFacility}</span>
                          {stops.length > 0 ? (
                            stops.map((st, i) => (
                              <React.Fragment key={i}>
                                <ArrowRight className="w-3 h-3 text-[#0D3978] shrink-0" />
                                <span className="bg-[#FFD000] text-[#092B60] font-black text-[10px] px-2 py-0.5 rounded shadow-2xs whitespace-nowrap">
                                  {st.sequence || i + 1}. {st.facilityName}
                                </span>
                              </React.Fragment>
                            ))
                          ) : (
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <ArrowRight className="w-3 h-3 text-[#0D3978] shrink-0" />
                          <span className="font-bold text-[#0D3978]">{req.destination}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 align-middle">
                        <div className="font-bold text-[#0D3978] text-xs">
                          {req.destination}
                        </div>
                      </td>

                      <td className="px-3 py-3 align-middle">
                        <span className="font-medium text-slate-700 text-xs">{req.vehicleType}</span>
                      </td>

                      <td className="px-3 py-3 align-middle text-center">
                        <span className="font-mono font-black text-[#092B60] text-sm">
                          {req.totalQuantity}
                        </span>
                      </td>

                      <td className="px-3 py-3 align-middle text-center">
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          {metrics.reported}
                        </span>
                        {metrics.pending > 0 && (
                          <div className="text-[10px] font-bold text-amber-700">
                            ({metrics.pending} bekliyor)
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 align-middle text-center">
                        <span className="font-mono font-black text-[#239B70] text-sm">
                          {metrics.approved}
                        </span>
                      </td>

                      <td className="px-3 py-3 align-middle text-center">
                        {metrics.remaining === 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            Tamamlandı
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-rose-100 text-rose-900 border border-rose-300">
                            {metrics.remaining} Araç
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 align-middle text-right">
                        <button
                          onClick={() => toggleRequestExpand(req.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-2xs active:scale-98 ${
                            isExpanded
                              ? 'bg-[#092B60] text-[#FFD000]'
                              : 'bg-[#EAF3FF] text-[#092B60] hover:bg-[#d8e8fc] border border-blue-200'
                          }`}
                        >
                          <span>{isExpanded ? 'Gizle' : 'Detay'}</span>
                          {metrics.pending > 0 && !isExpanded && (
                            <span className="bg-amber-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-mono">
                              {metrics.pending}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Kompakt Açılır Talep Detayı */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 border-b border-slate-200">
                        <td colSpan={10} className="p-4">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                              <div>
                                <h3 className="font-black text-[#092B60] text-xs flex items-center gap-1.5">
                                  <Truck className="w-4 h-4 text-[#0D3978]" />
                                  <span>{req.requestNumber} – Tedarikçi Bildirimleri ve Onay Merkezi</span>
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                  Rota: {req.originFacility} → {req.destination} • İhtiyaç: {req.totalQuantity} Araç
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {req.status !== 'CANCELLED' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenReviseModal(req, true)}
                                      className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition-colors"
                                      title="Termin Tarihi/Saati Güncelle ve Tedarikçilere Bildir"
                                    >
                                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Termin Güncelle</span>
                                    </button>
                                    <button
                                      onClick={() => handleOpenReviseModal(req, false)}
                                      className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition-colors"
                                      title="Talebi Revize Et ve Tedarikçilere Bildir"
                                    >
                                      <History className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Talebi Revize Et</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCancelModalReq(req);
                                        setCancelReason('');
                                      }}
                                      className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-2.5 py-1.5 rounded-xl text-[11px] transition-colors"
                                      title="Talebi İptal Et ve Tedarikçilere Bildir"
                                    >
                                      <X className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Talebi İptal Et</span>
                                    </button>
                                  </>
                                )}

                                {selectedCount > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-bold text-slate-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                      {selectedCount} Araç Seçildi
                                    </span>
                                    <button
                                      onClick={handleBatchApprove}
                                      disabled={actionLoading}
                                      className="inline-flex items-center gap-1.5 bg-[#239B70] hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-xl shadow-xs transition-colors active:scale-98"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{actionLoading ? 'Onaylanıyor...' : 'Seçilenleri Toplu Onayla'}</span>
                                    </button>
                                    <button
                                      onClick={() => setSelectedVehicleIds({})}
                                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                                      title="Seçimi Temizle"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Tedarikçi Dağılım Özeti */}
                            <div>
                              <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
                                Tedarikçi Dağılım & Karşılama Durumu:
                              </div>
                              <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-[#092B60] text-white uppercase text-[9px] font-black">
                                    <tr>
                                      <th className="px-3 py-2">Firma Adı</th>
                                      <th className="px-3 py-2 text-center">Bildirdiği Araç</th>
                                      <th className="px-3 py-2 text-center">Onaylanan Araç</th>
                                      <th className="px-3 py-2 text-center">Onay Bekleyen</th>
                                      <th className="px-3 py-2 text-center">Reddedilen</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {suppliers.map((sup) => {
                                      const supVehicles = metrics.vehicles.filter((v) => v.supplierId === sup.id);
                                      const supReported = supVehicles.length;
                                      const supApproved = supVehicles.filter((v) =>
                                        ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
                                      ).length;
                                      const supPending = supVehicles.filter((v) =>
                                        ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'ARAC_BILDIRILDI', 'YONETICI_ONAYI', 'YANIT_BEKLENIYOR'].includes(v.status)
                                      ).length;
                                      const supRejected = supVehicles.filter((v) => v.status === 'REJECTED').length;

                                      return (
                                        <tr key={sup.id} className="hover:bg-slate-50/50">
                                          <td className="px-3 py-2 font-bold text-[#092B60]">
                                            {sup.companyName}
                                          </td>
                                          <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">
                                            {supReported}
                                          </td>
                                          <td className="px-3 py-2 text-center font-mono font-black text-[#239B70]">
                                            {supApproved}
                                          </td>
                                          <td className="px-3 py-2 text-center font-mono font-bold text-amber-800">
                                            {supPending}
                                          </td>
                                          <td className="px-3 py-2 text-center font-mono font-bold text-rose-700">
                                            {supRejected}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Bildirilen Araçlar Listesi */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                  Bildirilen Araçlar Listesi ({metrics.vehicles.length} Araç):
                                </div>
                                {metrics.pending > 0 && (
                                  <button
                                    onClick={() => handleSelectAllPendingForRequest(metrics.vehicles)}
                                    className="text-[11px] font-bold text-[#0D3978] hover:underline"
                                  >
                                    Bekleyen Tümünü Seç / Bırak
                                  </button>
                                )}
                              </div>

                              {metrics.vehicles.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                  Bu talep için henüz herhangi bir tedarikçi araç bildiriminde bulunmamıştır.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-[#0D3978] text-white uppercase text-[9px] font-black">
                                      <tr>
                                        <th className="px-3 py-2.5 w-8 text-center">Seç</th>
                                        <th className="px-3 py-2.5">Plaka & Araç</th>
                                        <th className="px-3 py-2.5">Tedarikçi</th>
                                        <th className="px-3 py-2.5">Şoför & İletişim</th>
                                        <th className="px-3 py-2.5">Tahmini Giriş</th>
                                        <th className="px-3 py-2.5">Mevcut Durum</th>
                                        <th className="px-3 py-2.5 text-center">Revizyon</th>
                                        <th className="px-3 py-2.5 text-right">Doğrudan İşlemler</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {metrics.vehicles.map((v) => {
                                        const sup = suppliers.find((s) => s.id === v.supplierId);
                                        const statusMeta = VEHICLE_STATUS_LABELS[v.status] || {
                                          label: v.status,
                                          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
                                        };
                                        const isApproved = [
                                          'APPROVED',
                                          'ON_THE_WAY',
                                          'ARRIVED',
                                          'TEYIT_EDILDI',
                                          'TESISE_GIRIS_YAPTI',
                                        ].includes(v.status);
                                        const isPending = [
                                          'SUPPLIER_REPORTED',
                                          'REVISION_PENDING',
                                          'ARAC_BILDIRILDI',
                                          'YONETICI_ONAYI',
                                          'YANIT_BEKLENIYOR',
                                        ].includes(v.status);
                                        const isRejected = v.status === 'REJECTED';

                                        return (
                                          <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-3 py-2.5 text-center">
                                              <input
                                                type="checkbox"
                                                checked={!!selectedVehicleIds[v.id]}
                                                onChange={() => handleToggleSelectVehicle(v.id)}
                                                className="w-4 h-4 rounded text-[#092B60] focus:ring-[#092B60] border-slate-300"
                                              />
                                            </td>

                                            <td className="px-3 py-2.5">
                                              <div className="font-mono font-black text-[#092B60] text-xs flex items-center gap-1">
                                                <Truck className="w-3.5 h-3.5 text-[#092B60]" />
                                                <span>{v.plate}</span>
                                              </div>
                                              <div className="text-[10px] text-slate-500 font-medium">
                                                {v.vehicleType}
                                              </div>
                                            </td>

                                            <td className="px-3 py-2.5">
                                              <span className="font-bold text-slate-800">
                                                {sup?.companyName || v.supplierId}
                                              </span>
                                            </td>

                                            <td className="px-3 py-2.5">
                                              <div className="font-bold text-slate-900 flex items-center gap-1">
                                                <User className="w-3 h-3 text-slate-400" />
                                                <span>{v.driverName}</span>
                                              </div>
                                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                                <Phone className="w-3 h-3 text-slate-400" />
                                                <span>{v.driverPhone}</span>
                                              </div>
                                            </td>

                                            <td className="px-3 py-2.5 font-mono text-slate-700">
                                              {v.expectedArrival || '09:00'}
                                            </td>

                                            <td className="px-3 py-2.5">
                                              <span
                                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.badgeClass}`}
                                              >
                                                {statusMeta.label}
                                              </span>
                                            </td>

                                            <td className="px-3 py-2.5 text-center">
                                              {v.revisionCount && v.revisionCount > 0 ? (
                                                <button
                                                  onClick={() => setRevisionModalVehicle(v)}
                                                  className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors"
                                                  title="Revizyon geçmişini incele"
                                                >
                                                  <History className="w-3 h-3 text-amber-700" />
                                                  <span>Revize ({v.revisionCount})</span>
                                                </button>
                                              ) : (
                                                <span className="text-[10px] text-slate-400">İlk Kayıt</span>
                                              )}
                                            </td>

                                            <td className="px-3 py-2.5 text-right">
                                              <div className="inline-flex items-center gap-1.5 justify-end">
                                                {isPending ? (
                                                  <>
                                                    <button
                                                      onClick={() => handleSingleApprove(v.id)}
                                                      disabled={actionLoading}
                                                      className="inline-flex items-center gap-1 bg-[#239B70] hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-black shadow-2xs transition-colors active:scale-98"
                                                    >
                                                      <Check className="w-3.5 h-3.5" />
                                                      <span>Onayla</span>
                                                    </button>
                                                    <button
                                                      onClick={() => {
                                                        setRejectModalVehicle(v);
                                                        setRejectReason('');
                                                      }}
                                                      disabled={actionLoading}
                                                      className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors active:scale-98"
                                                    >
                                                      <X className="w-3.5 h-3.5" />
                                                      <span>Reddet</span>
                                                    </button>
                                                  </>
                                                ) : isApproved ? (
                                                  <div className="flex items-center gap-1 text-emerald-800 font-black text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                    <Check className="w-3 h-3" />
                                                    <span>Onaylandı</span>
                                                  </div>
                                                ) : isRejected ? (
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-rose-700 font-bold text-[10px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                      Reddedildi
                                                    </span>
                                                    <button
                                                      onClick={() => handleSingleApprove(v.id)}
                                                      className="text-[10px] text-[#092B60] underline font-bold ml-1 hover:text-[#0D3978]"
                                                    >
                                                      Yeniden Onayla
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <button
                                                    onClick={() => handleSingleApprove(v.id)}
                                                    className="text-[11px] font-bold text-[#092B60] hover:underline"
                                                  >
                                                    Onayla
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 font-medium">
                    {hasActiveFilters
                      ? 'Belirtilen filtrelere uygun araç talebi bulunamadı.'
                      : 'Henüz sistemde kayıtlı araç talebi bulunmamaktadır. "Yeni Uğraklı Araç Talebi Aç" butonuyla ilk talebi oluşturabilirsiniz.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revision Modal */}
      {revisionModalVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-[#092B60]">
                  Araç Revizyon Geçmişi – {revisionModalVehicle.plate}
                </h3>
              </div>
              <button
                onClick={() => setRevisionModalVehicle(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-amber-900 font-bold block">Toplam Revizyon Sayısı:</span>
                  <span className="text-amber-700 text-[11px]">Tedarikçi tarafından yapılan güncelleme</span>
                </div>
                <span className="font-mono font-black text-xl text-amber-900 bg-white px-3 py-1 rounded-lg border border-amber-300">
                  {revisionModalVehicle.revisionCount || 1}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">GÜNCEL ŞOFÖR</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{revisionModalVehicle.driverName}</span>
                  <span className="font-mono text-slate-600 text-xs mt-0.5 block">{revisionModalVehicle.driverPhone}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">GİRİŞ PLANI</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                    {revisionModalVehicle.requiredDate || 'Tarih belirtilmedi'}
                  </span>
                  <span className="font-mono text-slate-600 text-xs mt-0.5 block">
                    Saat: {revisionModalVehicle.expectedArrival || '09:00'}
                  </span>
                </div>
              </div>

              {revisionModalVehicle.description && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">REVİZYON NOTU</span>
                  <p className="text-slate-800 font-medium mt-1 italic">
                    "{revisionModalVehicle.description}"
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setRevisionModalVehicle(null)}
                className="bg-[#092B60] hover:bg-[#0D3978] text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalVehicle && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-black text-rose-950">
                  Araç Reddetme Onayı
                </h3>
              </div>
              <button
                onClick={() => setRejectModalVehicle(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-700">
                <strong className="font-mono text-[#092B60]">{rejectModalVehicle.plate}</strong> plakalı{' '}
                <strong>({rejectModalVehicle.driverName})</strong> aracı reddetmek üzeresiniz.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Reddetme Gerekçesi (Opsiyonel):
                </label>
                <textarea
                  rows={2}
                  placeholder="Örn: Evrak eksikliği, hatalı araç tipi veya plaka uyuşmazlığı..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectModalVehicle(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-colors active:scale-98"
              >
                {actionLoading ? 'İşleniyor...' : 'Aracı Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Revision / Deadline Update Modal */}
      {reviseModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#092B60]" />
                <h3 className="text-base font-black text-[#092B60]">
                  {isDeadlineOnly ? 'Termin Bilgisi Güncelle' : 'Araç Talebi Revizyonu'} – {reviseModalReq.requestNumber}
                </h3>
              </div>
              <button
                onClick={() => setReviseModalReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Gerekli Tarih</label>
                  <input
                    type="date"
                    value={reviseDate}
                    onChange={(e) => setReviseDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Gerekli Saat</label>
                  <input
                    type="time"
                    value={reviseTime}
                    onChange={(e) => setReviseTime(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {!isDeadlineOnly && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Toplam Araç İhtiyacı</label>
                    <input
                      type="number"
                      min={1}
                      value={reviseQty}
                      onChange={(e) => setReviseQty(Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Operasyon Açıklaması</label>
                    <textarea
                      rows={2}
                      value={reviseDescription}
                      onChange={(e) => setReviseDescription(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tedarikçilere İletilecek Bildirim Notu:
                </label>
                <textarea
                  rows={2}
                  placeholder="Örn: Yükleme saati 1 saat erkene çekilmiştir..."
                  value={reviseNote}
                  onChange={(e) => setReviseNote(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setReviseModalReq(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmReviseRequest}
                disabled={actionLoading}
                className="bg-[#092B60] hover:bg-[#0D3978] text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-colors"
              >
                {actionLoading ? 'Gönderiliyor...' : 'Güncelle & Tedarikçilere Bildir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Cancellation Modal */}
      {cancelModalReq && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-black text-rose-950">
                  Araç Talebi İptali – {cancelModalReq.requestNumber}
                </h3>
              </div>
              <button
                onClick={() => setCancelModalReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-700">
                <strong className="font-mono text-[#092B60]">{cancelModalReq.requestNumber}</strong> numaralı araç talebini iptal etmek üzeresiniz. Atanmış tedarikçilere otomatik iptal e-postası, push ve uygulama içi bildirim gönderilecektir.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  İptal Gerekçesi:
                </label>
                <textarea
                  rows={2}
                  placeholder="Örn: Sevkiyat planı ertelendi..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setCancelModalReq(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmCancelRequest}
                disabled={actionLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md transition-colors"
              >
                {actionLoading ? 'İptal Ediliyor...' : 'Talebi İptal Et & Bildir'}
              </button>
            </div>
          </div>
        </div>
      )}

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
