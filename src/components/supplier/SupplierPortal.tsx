import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  VehicleRequest,
  RequestAssignment,
  Vehicle,
  Supplier,
  Facility,
  VEHICLE_STATUS_LABELS,
  SupplierRequestView,
} from '../../types';
import { addVehicle, reviseVehicle } from '../../services/logisticsService';
import {
  Building2,
  FileSpreadsheet,
  Truck,
  PlusCircle,
  Clock,
  Send,
  AlertCircle,
  Check,
  MapPin,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  X,
  Info,
  Calendar,
  Edit3,
  Phone,
  User,
} from 'lucide-react';
import { SupplierNotificationCenter } from './SupplierNotificationCenter';

interface SupplierPortalProps {
  requests: VehicleRequest[];
  assignments: RequestAssignment[];
  vehicles: Vehicle[];
  suppliers: Supplier[];
  facilities: Facility[];
  supplierViews?: SupplierRequestView[];
  currentTab: string;
  onNavigateToTab?: (tabId: string) => void;
}

export const SupplierPortal: React.FC<SupplierPortalProps> = ({
  requests,
  assignments,
  vehicles,
  suppliers,
  facilities,
  supplierViews = [],
  currentTab,
  onNavigateToTab,
}) => {
  const { userProfile, currentUser } = useAuth();
  const currentSupplierId = userProfile?.supplierId || '';
  const mySupplier = suppliers.find((s) => s.id === currentSupplierId);

  // STRICT PRIVACY: Filter ONLY to current supplier ID
  const myAssignments = assignments.filter((a) => a.supplierId === currentSupplierId);
  const myVehicles = vehicles.filter((v) => v.supplierId === currentSupplierId);

  // Combined assigned requests
  const myAssignedRequestIds = new Set([
    ...myAssignments.map((a) => a.requestId),
    ...supplierViews.filter((v) => v.supplierId === currentSupplierId).map((v) => v.requestId),
  ]);
  const myRequests = requests.filter((r) => myAssignedRequestIds.has(r.id));

  const activeFacilities = facilities.filter((f) => f.active !== false);

  // Fast License Plate Reporting Modal State
  const [fastPlateRequest, setFastPlateRequest] = useState<VehicleRequest | null>(null);
  const [fastPlate, setFastPlate] = useState('');
  const [fastDriverName, setFastDriverName] = useState('');
  const [fastDriverPhone, setFastDriverPhone] = useState('+90 ');
  const [fastArrivalDate, setFastArrivalDate] = useState(new Date().toISOString().split('T')[0]);
  const [fastArrivalTime, setFastArrivalTime] = useState('09:00');
  const [fastDescription, setFastDescription] = useState('');
  const [fastLoading, setFastLoading] = useState(false);
  const [fastError, setFastError] = useState<string | null>(null);

  // Vehicle Revision Modal State
  const [reviseTargetVehicle, setReviseTargetVehicle] = useState<Vehicle | null>(null);
  const [revPlate, setRevPlate] = useState('');
  const [revDriverName, setRevDriverName] = useState('');
  const [revDriverPhone, setRevDriverPhone] = useState('');
  const [revArrivalDate, setRevArrivalDate] = useState('');
  const [revArrivalTime, setRevArrivalTime] = useState('');
  const [revDescription, setRevDescription] = useState('');
  const [revLoading, setRevLoading] = useState(false);
  const [revError, setRevError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState<VehicleRequest | null>(null);
  const [selectedVehicleForDetail, setSelectedVehicleForDetail] = useState<Vehicle | null>(null);

  // Alerts State
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  // Filters & Search
  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');

  // Form state for Standard Add Vehicle Screen
  const [addPlate, setAddPlate] = useState('');
  const [addDriverName, setAddDriverName] = useState('');
  const [addDriverPhone, setAddDriverPhone] = useState('+90 ');
  const [addVehicleType, setAddVehicleType] = useState('TIR (Tenteli 13.60)');
  const [addReqId, setAddReqId] = useState('');
  const [addOrigin, setAddOrigin] = useState(activeFacilities[0]?.facilityName || 'ANKARA TM');
  const [addDest, setAddDest] = useState(activeFacilities[1]?.facilityName || 'İZMİR TM');
  const [addExpectedArrival, setAddExpectedArrival] = useState('09:00');
  const [addReqDate, setAddReqDate] = useState(new Date().toISOString().split('T')[0]);
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Handle Fast License Plate Submission
  const handleFastPlateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !fastPlateRequest) return;
    setFastError(null);

    const cleanPlateStr = fastPlate.toUpperCase().trim();
    if (!cleanPlateStr || !fastDriverName.trim() || !fastDriverPhone.trim()) {
      setFastError('Lütfen araç plakası, şoför adı ve telefon numarasını doldurunuz.');
      return;
    }

    setFastLoading(true);
    try {
      await addVehicle({
        requestId: fastPlateRequest.id,
        supplierId: currentSupplierId,
        plate: cleanPlateStr,
        driverName: fastDriverName.trim(),
        driverPhone: fastDriverPhone.trim(),
        vehicleType: fastPlateRequest.vehicleType,
        originFacility: fastPlateRequest.originFacility,
        routeStops: fastPlateRequest.routeStops || [],
        destination: fastPlateRequest.destination,
        requiredDate: fastArrivalDate,
        expectedArrival: fastArrivalTime,
        description: fastDescription,
        userUid: currentUser.uid,
        userRole: 'SUPPLIER',
      });

      setGlobalSuccess(`Plaka ${cleanPlateStr} başarıyla bildirildi ve Karşılanan Araçlar Listenize eklendi.`);
      setFastPlateRequest(null);
      setFastPlate('');
      setFastDriverName('');
      setFastDriverPhone('+90 ');
      setFastDescription('');
      setTimeout(() => setGlobalSuccess(null), 4000);
    } catch (err: any) {
      setFastError(err.message || 'Plaka bildirimi yapılırken hata oluştu.');
    } finally {
      setFastLoading(false);
    }
  };

  // Handle Vehicle Revision Submission
  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !reviseTargetVehicle) return;
    setRevError(null);

    if (!revPlate.trim() || !revDriverName.trim() || !revDriverPhone.trim()) {
      setRevError('Lütfen plaka, şoför adı ve telefon alanlarını doldurunuz.');
      return;
    }

    setRevLoading(true);
    try {
      await reviseVehicle({
        vehicleId: reviseTargetVehicle.id,
        plate: revPlate.toUpperCase().trim(),
        driverName: revDriverName.trim(),
        driverPhone: revDriverPhone.trim(),
        expectedArrival: revArrivalTime,
        requiredDate: revArrivalDate,
        description: revDescription,
        userUid: currentUser.uid,
        userRole: 'SUPPLIER',
      });

      setGlobalSuccess(`Araç ${revPlate} bilgileriniz revize edildi. Yönetici ve operatör bilgilendirildi.`);
      setReviseTargetVehicle(null);
      setTimeout(() => setGlobalSuccess(null), 4000);
    } catch (err: any) {
      setRevError(err.message || 'Revizyon kaydedilirken hata oluştu.');
    } finally {
      setRevLoading(false);
    }
  };

  // Standard Add Vehicle Form Handler
  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAddError(null);
    setAddSuccess(null);

    if (!addPlate.trim() || !addDriverName.trim() || !addDriverPhone.trim()) {
      setAddError('Lütfen plaka, şoför adı ve telefon numarasını eksiksiz doldurunuz.');
      return;
    }

    const selectedReq = myRequests.find((r) => r.id === addReqId);

    setAddLoading(true);
    try {
      await addVehicle({
        requestId: addReqId || 'REQ-GENEL',
        supplierId: currentSupplierId,
        plate: addPlate,
        driverName: addDriverName,
        driverPhone: addDriverPhone,
        vehicleType: addVehicleType,
        originFacility: addOrigin,
        routeStops: selectedReq?.routeStops || [],
        destination: addDest,
        requiredDate: addReqDate,
        expectedArrival: addExpectedArrival,
        userUid: currentUser.uid,
        userRole: 'SUPPLIER',
      });

      setAddSuccess(`Araç ${addPlate} başarıyla sisteme bildirildi ve Karşılanan Araçlarınıza eklendi.`);
      setAddPlate('');
      setAddDriverName('');
      setAddDriverPhone('+90 ');
      setTimeout(() => setAddSuccess(null), 3500);
    } catch (err: any) {
      setAddError(err.message || 'Araç ekleme sırasında hata oluştu.');
    } finally {
      setAddLoading(false);
    }
  };

  // NUMERICAL CALCULATION ENGINE (Requirement 8)
  const reportedVehiclesCount = myVehicles.filter((v) =>
    ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'APPROVED', 'ON_THE_WAY', 'ARRIVED', 'ARAC_BILDIRILDI', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;

  const approvedVehiclesCount = myVehicles.filter((v) =>
    ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;

  const arrivedVehiclesCount = myVehicles.filter((v) =>
    ['ARRIVED', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;

  const totalAssignedRequests = myRequests.length;
  const totalRequestedVehicles = myAssignments.reduce((acc, a) => acc + (a.assignedQuantity || 0), 0);

  return (
    <div className="space-y-6 text-xs text-slate-800">
      {/* Corporate Dynamic Supplier Header */}
      <div className="bg-[#092B60] text-white p-5 rounded-xl border border-[#0D3978] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-5 h-5 text-[#FFD000]" />
            <h1 className="text-lg font-black text-white">
              {mySupplier?.companyName || userProfile?.fullName || 'Tedarikçi Portalı'}
            </h1>
            <span className="bg-[#FFD000] text-[#092B60] font-black px-2.5 py-0.5 rounded text-[11px] shadow-2xs">
              GİZLİLİK KORUMALI TEDARİKÇİ PANELİ
            </span>
          </div>
          <p className="text-blue-200 mt-1">
            Yalnızca firmanıza atanan talepleri görüntüleyebilir, doğrudan plaka bildirimi ve araç revizyonu yapabilirsiniz.
          </p>
        </div>

        {/* 3 Separate Counters Engine (Requirement 8) */}
        <div className="flex items-center gap-2 text-center flex-wrap">
          <div className="bg-[#0D3978] px-3 py-2 rounded-lg border border-blue-700/50">
            <div className="text-blue-300 text-[10px] font-bold uppercase">1. BİLDİRİLEN ARAÇ</div>
            <div className="text-base font-black text-[#FFD000]">{reportedVehiclesCount}</div>
          </div>
          <div className="bg-[#0D3978] px-3 py-2 rounded-lg border border-blue-700/50">
            <div className="text-blue-300 text-[10px] font-bold uppercase">2. ONAYLANAN ARAÇ</div>
            <div className="text-base font-black text-[#A7F36B]">{approvedVehiclesCount}</div>
          </div>
          <div className="bg-[#0D3978] px-3 py-2 rounded-lg border border-blue-700/50">
            <div className="text-blue-300 text-[10px] font-bold uppercase">3. SAHAYA VARAN</div>
            <div className="text-base font-black text-white">{arrivedVehiclesCount}</div>
          </div>
        </div>
      </div>

      {globalSuccess && (
        <div className="p-4 bg-[#A7F36B]/20 text-emerald-950 border border-emerald-400 rounded-xl flex items-center gap-2 font-bold shadow-xs animate-in fade-in">
          <Check className="w-5 h-5 text-emerald-700 shrink-0" />
          <span>{globalSuccess}</span>
        </div>
      )}

      {/* ==================== 1. GENEL BAKIŞ (sup-overview) ==================== */}
      {(currentTab === 'sup-overview' || !currentTab) && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs text-center">
              <div className="text-slate-500 font-bold text-[10px]">Atanmış Talep</div>
              <div className="text-xl font-black text-[#092B60]">{totalAssignedRequests}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs text-center">
              <div className="text-slate-500 font-bold text-[10px]">Toplam İstenen Araç</div>
              <div className="text-xl font-black text-slate-800">{totalRequestedVehicles}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 text-center">
              <div className="text-amber-800 font-bold text-[10px]">Bildirilen Araç Sayısı</div>
              <div className="text-xl font-black text-amber-700">{reportedVehiclesCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-center">
              <div className="text-emerald-900 font-bold text-[10px]">Onaylanan Araç Sayısı</div>
              <div className="text-xl font-black text-emerald-700">{approvedVehiclesCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-green-200 bg-green-50/50 text-center">
              <div className="text-green-900 font-bold text-[10px]">Tesise Giriş Yapan</div>
              <div className="text-xl font-black text-green-700">{arrivedVehiclesCount}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 text-center">
              <div className="text-blue-900 font-bold text-[10px]">Kalan İhtiyaç</div>
              <div className="text-xl font-black text-[#092B60]">
                {Math.max(0, totalRequestedVehicles - approvedVehiclesCount)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Son Atanan Talepler ve Hızlı Plaka Bildir Butonları */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
              <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
                <h3 className="font-black text-xs flex items-center gap-2 text-white">
                  <FileSpreadsheet className="w-4 h-4 text-[#FFD000]" />
                  Aktif Talepleriniz & Hızlı Plaka Bildirimi
                </h3>
                <span className="text-[10px] bg-[#0D3978] px-2 py-0.5 rounded text-blue-200 font-bold">
                  {myRequests.length} Talep
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {myRequests.slice(0, 5).map((req) => {
                  const stops = req.routeStops || [];
                  const reqVehicles = myVehicles.filter((v) => v.requestId === req.id);
                  return (
                    <div key={req.id} className="p-4 hover:bg-slate-50 transition-colors space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-[#092B60] bg-[#EAF3FF] px-2 py-0.5 rounded border border-blue-200">
                            {req.requestNumber}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {req.originFacility} → {req.destination}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {req.requiredDate} {req.requiredTime}
                        </span>
                      </div>

                      {stops.length > 0 && (
                        <div className="text-[10px] text-[#092B60] font-bold bg-[#EAF3FF] p-2 rounded flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#092B60]" />
                          <span>Uğraklar: {stops.map((s) => s.facilityName).join(' → ')}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">
                        <div>
                          <span className="text-slate-500">Tipi: </span>
                          <strong className="text-slate-800 font-bold">{req.vehicleType}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">İhtiyaç: </span>
                          <strong className="text-slate-900 font-bold">{req.totalQuantity} Araç</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Bildirilen: </span>
                          <strong className="text-[#092B60] font-black">{reqVehicles.length} Araç</strong>
                        </div>

                        {/* HIZLI PLAKA BİLDİR BUTONU */}
                        <button
                          onClick={() => {
                            setFastPlateRequest(req);
                            setFastArrivalDate(req.requiredDate || new Date().toISOString().split('T')[0]);
                            setFastArrivalTime(req.requiredTime || '09:00');
                            setFastError(null);
                          }}
                          className="bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 shadow-2xs hover:scale-102"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-[#FFD000]" />
                          <span>PLAKA BİLDİR</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {myRequests.length === 0 && (
                  <div className="p-8 text-center text-slate-400 font-bold">Atanmış talep bulunmuyor.</div>
                )}
              </div>
            </div>

            {/* Karşılanan ve Bildirilen Son Araçlar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
              <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
                <h3 className="font-black text-xs flex items-center gap-2 text-white">
                  <Truck className="w-4 h-4 text-[#FFD000]" />
                  Son Bildirilen ve Karşılanan Araçlarınız
                </h3>
                <span className="text-[10px] bg-[#0D3978] px-2 py-0.5 rounded text-blue-200 font-bold">
                  Toplam {myVehicles.length}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {myVehicles.slice(0, 5).map((v) => {
                  const meta = VEHICLE_STATUS_LABELS[v.status] || {
                    label: v.status,
                    badgeClass: 'bg-slate-100 text-slate-700',
                  };
                  return (
                    <div key={v.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-[#092B60] text-sm">{v.plate}</span>
                          {(v.revisionCount || 0) > 0 && (
                            <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                              {v.revisionCount} Revize
                            </span>
                          )}
                        </div>
                        <div className="text-slate-700 font-semibold">{v.driverName} ({v.driverPhone})</div>
                        <div className="text-slate-500 text-[10px]">{v.originFacility} → {v.destination}</div>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] border ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setReviseTargetVehicle(v);
                              setRevPlate(v.plate);
                              setRevDriverName(v.driverName);
                              setRevDriverPhone(v.driverPhone);
                              setRevArrivalDate(v.requiredDate || new Date().toISOString().split('T')[0]);
                              setRevArrivalTime(v.expectedArrival || '09:00');
                              setRevDescription(v.description || '');
                              setRevError(null);
                            }}
                            className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded"
                          >
                            Revize Et
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {myVehicles.length === 0 && (
                  <div className="p-8 text-center text-slate-400 font-bold">Henüz bildirilmiş araç bulunmuyor.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. ATANMIŞ TALEPLERİM (sup-requests) ==================== */}
      {currentTab === 'sup-requests' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#092B60]" />
                Firmanıza Atanmış Tüm Araç Talepleri
              </h2>
              <p className="text-slate-500 text-[11px]">
                Herhangi bir teklif girmeden doğrudan "PLAKA BİLDİR" butonuna basarak plaka ve şoför ekleyebilirsiniz.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Talep no veya tesis ara..."
                value={requestSearchQuery}
                onChange={(e) => setRequestSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#092B60] text-white uppercase text-[10px] font-black border-b border-[#0D3978]">
                  <tr>
                    <th className="px-4 py-3">Talep No</th>
                    <th className="px-4 py-3">Çıkış Tesisi</th>
                    <th className="px-4 py-3">Uğraklar</th>
                    <th className="px-4 py-3">Varış Tesisi</th>
                    <th className="px-4 py-3">Araç Tipi</th>
                    <th className="px-4 py-3 text-center">İstenen Araç</th>
                    <th className="px-4 py-3 text-center">Bildirilen Plaka</th>
                    <th className="px-4 py-3">Tarih & Saat</th>
                    <th className="px-4 py-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myRequests
                    .filter(
                      (r) =>
                        r.requestNumber.toLowerCase().includes(requestSearchQuery.toLowerCase()) ||
                        r.originFacility.toLowerCase().includes(requestSearchQuery.toLowerCase()) ||
                        r.destination.toLowerCase().includes(requestSearchQuery.toLowerCase())
                    )
                    .map((req) => {
                      const stops = req.routeStops || [];
                      const reqVehicles = myVehicles.filter((v) => v.requestId === req.id);
                      return (
                        <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-black text-[#092B60]">
                            {req.requestNumber}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">{req.originFacility}</td>
                          <td className="px-4 py-3">
                            {stops.length > 0 ? (
                              <span className="bg-[#EAF3FF] text-[#092B60] font-bold px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                                {stops.length} Uğrak ({stops.map((s) => s.facilityName).join(', ')})
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold text-[10px]">Direkt</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#0D3978]">{req.destination}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">{req.vehicleType}</td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">{req.totalQuantity}</td>
                          <td className="px-4 py-3 text-center font-black text-[#092B60]">{reqVehicles.length}</td>
                          <td className="px-4 py-3 text-slate-600 font-semibold">{req.requiredDate} {req.requiredTime}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedRequestForDetail(req)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-300"
                              >
                                Detay
                              </button>

                              {/* HIZLI PLAKA BİLDİR */}
                              <button
                                onClick={() => {
                                  setFastPlateRequest(req);
                                  setFastArrivalDate(req.requiredDate || new Date().toISOString().split('T')[0]);
                                  setFastArrivalTime(req.requiredTime || '09:00');
                                  setFastError(null);
                                }}
                                className="px-3 py-1 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-bold rounded shadow-2xs flex items-center gap-1"
                              >
                                <PlusCircle className="w-3.5 h-3.5 text-[#FFD000]" />
                                <span>PLAKA BİLDİR</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {myRequests.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-bold">
                        Firmanıza atanmış herhangi bir talep bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. YANIT BEKLEYEN TALEPLER (sup-pending) ==================== */}
      {currentTab === 'sup-pending' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-sm text-amber-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Hızlı Plaka Bildirimi Bekleyen Talepleriniz ({myRequests.length})
              </h2>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Herhangi bir teklif aşaması olmadan doğrudan "PLAKA BİLDİR" butonuna basarak araçlarınızı sisteme ekleyebilirsiniz.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myRequests.map((req) => {
              const stops = req.routeStops || [];
              const reqVehicles = myVehicles.filter((v) => v.requestId === req.id);
              return (
                <div key={req.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="font-mono font-black text-[#092B60] bg-[#EAF3FF] px-2 py-0.5 rounded border border-blue-200">
                        {req.requestNumber}
                      </span>
                      <h3 className="font-black text-slate-900 text-sm mt-1">
                        {req.originFacility} → {req.destination}
                      </h3>
                    </div>
                    <span className="bg-[#EAF3FF] text-[#092B60] font-bold px-2.5 py-1 rounded-full text-[10px] border border-blue-200">
                      {reqVehicles.length} / {req.totalQuantity} Araç Bildirildi
                    </span>
                  </div>

                  {stops.length > 0 && (
                    <div className="p-2.5 bg-[#EAF3FF] rounded-lg border border-blue-200 text-[11px] font-bold text-[#092B60] flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#092B60] shrink-0" />
                      <span>Güzergâh: {req.originFacility} → {stops.map((s) => s.facilityName).join(' → ')} → {req.destination}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block">Araç Tipi:</span>
                      <strong className="text-slate-800 font-bold">{req.vehicleType}</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block">Sefer Tarihi:</span>
                      <strong className="text-slate-800 font-bold">{req.requiredDate} {req.requiredTime}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setFastPlateRequest(req);
                      setFastArrivalDate(req.requiredDate || new Date().toISOString().split('T')[0]);
                      setFastArrivalTime(req.requiredTime || '09:00');
                      setFastError(null);
                    }}
                    className="w-full py-2.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-bold rounded-lg shadow-sm text-xs flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4 text-[#FFD000]" />
                    <span>PLAKA BİLDİR</span>
                  </button>
                </div>
              );
            })}

            {myRequests.length === 0 && (
              <div className="col-span-2 bg-white p-8 rounded-xl border border-slate-200 shadow-md text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 text-sm">Tebrikler! Atanmış aktif bir talep bulunmuyor.</h4>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 4. KARŞILANAN ARAÇLARIM (sup-fulfilled) ==================== */}
      {(currentTab === 'sup-fulfilled' || currentTab === 'sup-vehicles') && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Karşılanan Araçlarım ve Sefer Takibi ({myVehicles.length})
              </h2>
              <p className="text-slate-500 text-[11px]">
                Plakasını ve şoför bilgilerini bildirdiğiniz araçlar. Gerektiğinde "REVİZE ET" butonunu kullanarak şoför veya saat güncelleyebilirsiniz.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Plaka veya şoför ara..."
                value={vehicleSearchQuery}
                onChange={(e) => setVehicleSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#092B60] text-white uppercase text-[10px] font-black border-b border-[#0D3978]">
                  <tr>
                    <th className="px-4 py-3">Plaka</th>
                    <th className="px-4 py-3">Şoför</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Araç Tipi</th>
                    <th className="px-4 py-3">Çıkış Tesisi</th>
                    <th className="px-4 py-3">Uğraklar</th>
                    <th className="px-4 py-3">Varış Tesisi</th>
                    <th className="px-4 py-3">Tahmini Giriş</th>
                    <th className="px-4 py-3">Bildirim Tarihi</th>
                    <th className="px-4 py-3">Yönetici Onay Durumu</th>
                    <th className="px-4 py-3 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myVehicles
                    .filter(
                      (v) =>
                        v.plate.toLowerCase().includes(vehicleSearchQuery.toLowerCase()) ||
                        v.driverName.toLowerCase().includes(vehicleSearchQuery.toLowerCase())
                    )
                    .map((v) => {
                      const meta = VEHICLE_STATUS_LABELS[v.status] || {
                        label: v.status,
                        badgeClass: 'bg-slate-100 text-slate-700',
                      };
                      const stops = v.routeStops || [];
                      const formattedDate = v.createdAt?.seconds
                        ? new Date(v.createdAt.seconds * 1000).toLocaleDateString('tr-TR')
                        : (v.requiredDate || '-');

                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-black text-[#092B60]">
                            <div className="flex items-center gap-1.5">
                              <span>{v.plate}</span>
                              {(v.revisionCount || 0) > 0 && (
                                <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                                  {v.revisionCount} Revize
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">{v.driverName}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{v.driverPhone}</td>
                          <td className="px-4 py-3 text-slate-700 font-medium">{v.vehicleType}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{v.originFacility}</td>
                          <td className="px-4 py-3">
                            {stops.length > 0 ? (
                              <span className="bg-[#EAF3FF] text-[#092B60] px-2 py-0.5 rounded font-bold text-[10px]">
                                {stops.length} Uğrak
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold text-[10px]">Direkt</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#0D3978]">{v.destination}</td>
                          <td className="px-4 py-3 font-mono text-slate-700">{v.expectedArrival || '09:00'}</td>
                          <td className="px-4 py-3 text-slate-500 font-semibold">{formattedDate}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] border ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedVehicleForDetail(v)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-300"
                              >
                                DETAY
                              </button>
                              <button
                                onClick={() => {
                                  setReviseTargetVehicle(v);
                                  setRevPlate(v.plate);
                                  setRevDriverName(v.driverName);
                                  setRevDriverPhone(v.driverPhone);
                                  setRevArrivalDate(v.requiredDate || new Date().toISOString().split('T')[0]);
                                  setRevArrivalTime(v.expectedArrival || '09:00');
                                  setRevDescription(v.description || '');
                                  setRevError(null);
                                }}
                                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-amber-950 font-black rounded border border-amber-500 shadow-2xs flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3 text-amber-950" />
                                <span>REVİZE ET</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {myVehicles.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500 font-bold">
                        Karşılanan araç listenizde henüz kayıt bulunmuyor.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 5. YENİ ARAÇ BİLDİR (sup-new-vehicle) ==================== */}
      {currentTab === 'sup-new-vehicle' && (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-md">
          <h2 className="text-sm font-bold text-[#092B60] mb-1 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-[#092B60]" />
            Sefer İçin Araç & Şoför Kaydı
          </h2>
          <p className="text-slate-500 mb-4">
            Plaka, şoför ve iletişim detaylarını sisteme girerek aracı Karşılanan Araçlar listenize ekleyin.
          </p>

          {addError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{addError}</span>
            </div>
          )}
          {addSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{addSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateVehicle} className="space-y-4">
            <div>
              <label className="block font-bold text-[#092B60] mb-1">İlgili Araç Talebi</label>
              <select
                value={addReqId}
                onChange={(e) => {
                  setAddReqId(e.target.value);
                  const selected = myRequests.find((r) => r.id === e.target.value);
                  if (selected) {
                    setAddOrigin(selected.originFacility);
                    setAddDest(selected.destination);
                    setAddVehicleType(selected.vehicleType);
                    setAddReqDate(selected.requiredDate);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-[#092B60]"
              >
                <option value="">-- Atanmış Talep Seçiniz (İsteğe Bağlı) --</option>
                {myRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.requestNumber} ({r.originFacility} → {r.destination})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Araç Plakası *</label>
                <input
                  type="text"
                  placeholder="34 ABC 789"
                  value={addPlate}
                  onChange={(e) => setAddPlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-black text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Araç Tipi</label>
                <select
                  value={addVehicleType}
                  onChange={(e) => setAddVehicleType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="TIR (Tenteli 13.60)">TIR (Tenteli 13.60)</option>
                  <option value="TIR (Frigo / Termokin)">TIR (Frigo / Termokin)</option>
                  <option value="Kamyon (10 Teker)">Kamyon (10 Teker)</option>
                  <option value="Kamyonet (Panelvan / Liftli)">Kamyonet (Panelvan / Liftli)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Şoför Adı Soyadı *</label>
                <input
                  type="text"
                  placeholder="Ahmet Yılmaz"
                  value={addDriverName}
                  onChange={(e) => setAddDriverName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Şoför Telefon No *</label>
                <input
                  type="text"
                  placeholder="+90 532 000 0000"
                  value={addDriverPhone}
                  onChange={(e) => setAddDriverPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Çıkış Tesisi</label>
                <select
                  value={addOrigin}
                  onChange={(e) => setAddOrigin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {activeFacilities.map((f) => (
                    <option key={f.id} value={f.facilityName}>
                      {f.facilityName} ({f.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Son Varış Tesisi</label>
                <select
                  value={addDest}
                  onChange={(e) => setAddDest(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  {activeFacilities.map((f) => (
                    <option key={f.id} value={f.facilityName}>
                      {f.facilityName} ({f.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Sefer Tarihi</label>
                <input
                  type="date"
                  value={addReqDate}
                  onChange={(e) => setAddReqDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Tahmini Giriş Saati</label>
                <input
                  type="time"
                  value={addExpectedArrival}
                  onChange={(e) => setAddExpectedArrival(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addLoading}
              className="w-full py-2.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-bold rounded-lg shadow-md transition-colors text-sm"
            >
              {addLoading ? 'Kaydediliyor...' : 'Aracı Sisteme Kaydet & Operasyon Ekibine Bildir'}
            </button>
          </form>
        </div>
      )}

      {/* ==================== 6. PERFORMANS (sup-performance) ==================== */}
      {currentTab === 'sup-performance' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md">
            <h2 className="font-black text-sm text-[#092B60] mb-1 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#092B60]" />
              Firma Performans Karnesi ve Lojistik Skor Tablosu
            </h2>
            <p className="text-slate-500 text-[11px]">
              {mySupplier?.companyName || 'Tedarikçi'} için bildirilen, onaylanan ve sahaya giriş yapan araç metrikleri.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
              <div className="text-slate-500 font-bold text-xs">Bildirilen Toplam Araç</div>
              <div className="text-3xl font-black text-[#092B60] my-1">{reportedVehiclesCount}</div>
              <div className="text-[10px] text-slate-400 font-semibold">Tarafınızdan Sisteme Bildirildi</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
              <div className="text-slate-500 font-bold text-xs">Yönetici Onaylı Araç</div>
              <div className="text-3xl font-black text-emerald-700 my-1">{approvedVehiclesCount}</div>
              <div className="text-[10px] text-slate-400 font-semibold">Operasyon Tarafından Doğrulandı</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
              <div className="text-slate-500 font-bold text-xs">Tesise Giriş Yapan Araç</div>
              <div className="text-3xl font-black text-green-700 my-1">{arrivedVehiclesCount}</div>
              <div className="text-[10px] text-slate-400 font-semibold">Seferi Başarıyla Tamamlandı</div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 7. BİLDİRİMLER & TERCİHLER (sup-notifications) ==================== */}
      {currentTab === 'sup-notifications' && (
        <SupplierNotificationCenter
          supplierId={currentSupplierId}
          supplier={mySupplier}
          onSelectRequest={(reqId) => {
            const foundReq = myRequests.find((r) => r.id === reqId);
            if (foundReq) {
              setSelectedRequestForDetail(foundReq);
            } else if (onNavigateToTab) {
              onNavigateToTab('sup-requests');
            }
          }}
        />
      )}

      {/* ==================== MODAL: HIZLI PLAKA BİLDİRİMİ (Requirement 2) ==================== */}
      {fastPlateRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-xs space-y-4 border border-[#092B60]/30">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="font-mono font-black text-[#092B60] bg-[#EAF3FF] px-2 py-0.5 rounded border border-blue-200">
                  {fastPlateRequest.requestNumber}
                </span>
                <h3 className="font-black text-sm text-[#092B60] mt-1">
                  Hızlı Plaka & Şoför Bildirimi
                </h3>
              </div>
              <button
                onClick={() => setFastPlateRequest(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Otomatik Getirilen Bilgiler Panel */}
            <div className="bg-[#EAF3FF] p-3 rounded-lg border border-blue-200 space-y-1.5">
              <div className="font-bold text-[#092B60] flex items-center gap-1.5 text-[11px]">
                <Info className="w-3.5 h-3.5 text-[#092B60]" />
                Talep Detayları (Otomatik Aktarıldı)
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-semibold">
                <div>Çıkış: <strong>{fastPlateRequest.originFacility}</strong></div>
                <div>Varış: <strong>{fastPlateRequest.destination}</strong></div>
                <div>Araç Tipi: <strong>{fastPlateRequest.vehicleType}</strong></div>
                <div>Talep Tarihi: <strong>{fastPlateRequest.requiredDate}</strong></div>
              </div>
            </div>

            {fastError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{fastError}</span>
              </div>
            )}

            <form onSubmit={handleFastPlateSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Araç Plakası *</label>
                <input
                  type="text"
                  placeholder="34 ABC 789"
                  value={fastPlate}
                  onChange={(e) => setFastPlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-black text-sm text-slate-900 focus:ring-2 focus:ring-[#092B60]"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Şoför Adı Soyadı *</label>
                  <input
                    type="text"
                    placeholder="Ahmet Yılmaz"
                    value={fastDriverName}
                    onChange={(e) => setFastDriverName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Şoför Telefon *</label>
                  <input
                    type="text"
                    placeholder="+90 532 000 0000"
                    value={fastDriverPhone}
                    onChange={(e) => setFastDriverPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Tahmini Giriş Tarihi</label>
                  <input
                    type="date"
                    value={fastArrivalDate}
                    onChange={(e) => setFastArrivalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Tahmini Giriş Saati</label>
                  <input
                    type="time"
                    value={fastArrivalTime}
                    onChange={(e) => setFastArrivalTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Operasyon Notu (İsteğe Bağlı)</label>
                <textarea
                  rows={2}
                  placeholder="Örn: Araç saat 08:30 itibarıyla tesise girmeye hazırdır."
                  value={fastDescription}
                  onChange={(e) => setFastDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFastPlateRequest(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={fastLoading}
                  className="px-5 py-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-lg shadow-md flex items-center gap-1.5"
                >
                  {fastLoading ? 'Kaydediliyor...' : 'PLAKA BİLDİRİMİNİ GÖNDER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ARAÇ REVİZYONU (Requirement 5) ==================== */}
      {reviseTargetVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-xs space-y-4 border border-amber-400">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-black text-sm text-[#092B60]">
                    Araç Bilgilerini Revize Et
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Plaka: {reviseTargetVehicle.plate}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setReviseTargetVehicle(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {revError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{revError}</span>
              </div>
            )}

            <form onSubmit={handleReviseSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Araç Plakası *</label>
                <input
                  type="text"
                  value={revPlate}
                  onChange={(e) => setRevPlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-black text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Şoför Adı Soyadı *</label>
                  <input
                    type="text"
                    value={revDriverName}
                    onChange={(e) => setRevDriverName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Şoför Telefon *</label>
                  <input
                    type="text"
                    value={revDriverPhone}
                    onChange={(e) => setRevDriverPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Tahmini Giriş Tarihi</label>
                  <input
                    type="date"
                    value={revArrivalDate}
                    onChange={(e) => setRevArrivalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Tahmini Giriş Saati</label>
                  <input
                    type="time"
                    value={revArrivalTime}
                    onChange={(e) => setRevArrivalTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Revizyon Sebebi / Açıklama</label>
                <textarea
                  rows={2}
                  placeholder="Örn: Şoför değişikliği sebebiyle bilgiler güncellendi."
                  value={revDescription}
                  onChange={(e) => setRevDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-900 font-semibold">
                * Revizyon yapıldığında eski bilgiler silinmez; auditLogs kayıtlarında saklanır ve Yönetici ile Operatörlere anlık bildirim gönderilir.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviseTargetVehicle(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={revLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 font-black rounded-lg shadow-md flex items-center gap-1.5"
                >
                  {revLoading ? 'Kaydediliyor...' : 'REVİZYONU KAYDET & BİLDİR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: REQUEST DETAIL ==================== */}
      {selectedRequestForDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#FFD000]" />
                Talep Detayı #{selectedRequestForDetail.requestNumber}
              </h3>
              <button
                onClick={() => setSelectedRequestForDetail(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#EAF3FF] rounded-lg border border-blue-200">
                <div className="font-bold text-[#092B60] mb-1">Güzergâh ve Uğrak Noktaları</div>
                <div className="text-slate-800 font-black text-sm">
                  {selectedRequestForDetail.originFacility} → {selectedRequestForDetail.destination}
                </div>
                {selectedRequestForDetail.routeStops && selectedRequestForDetail.routeStops.length > 0 && (
                  <div className="mt-2 space-y-1 pl-2 border-l-2 border-[#092B60]">
                    {selectedRequestForDetail.routeStops.map((st, i) => (
                      <div key={i} className="text-slate-700 font-semibold">
                        {st.sequence}. Uğrak: {st.facilityName} {st.note && `(${st.note})`}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="text-slate-500 block">Araç Tipi:</span>
                  <strong className="text-slate-900 font-bold">{selectedRequestForDetail.vehicleType}</strong>
                </div>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <span className="text-slate-500 block">Toplam İhtiyaç:</span>
                  <strong className="text-slate-900 font-bold">{selectedRequestForDetail.totalQuantity} Araç</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedRequestForDetail(null)}
                className="px-4 py-2 bg-[#092B60] text-white font-bold rounded-lg"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: VEHICLE DETAIL ==================== */}
      {selectedVehicleForDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#FFD000]" />
                Araç Sefer Detayı ({selectedVehicleForDetail.plate})
              </h3>
              <button
                onClick={() => setSelectedVehicleForDetail(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 font-bold">Plaka:</span>
                <span className="font-mono font-black text-[#092B60] text-sm">{selectedVehicleForDetail.plate}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 font-bold">Şoför Adı:</span>
                <span className="font-bold text-slate-800">{selectedVehicleForDetail.driverName}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 font-bold">Telefon:</span>
                <span className="font-mono text-slate-700">{selectedVehicleForDetail.driverPhone}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 font-bold">Çıkış → Varış:</span>
                <span className="font-bold text-[#0D3978]">{selectedVehicleForDetail.originFacility} → {selectedVehicleForDetail.destination}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 font-bold">Tahmini Giriş:</span>
                <span className="font-mono font-bold text-slate-800">{selectedVehicleForDetail.expectedArrival || '09:00'}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 font-bold">Durum:</span>
                <span className="font-bold text-emerald-800">
                  {VEHICLE_STATUS_LABELS[selectedVehicleForDetail.status]?.label || selectedVehicleForDetail.status}
                </span>
              </div>
              {(selectedVehicleForDetail.revisionCount || 0) > 0 && (
                <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900 font-bold">
                  Bu araç {selectedVehicleForDetail.revisionCount} kez revize edilmiştir.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedVehicleForDetail(null)}
                className="px-4 py-2 bg-[#092B60] text-white font-bold rounded-lg"
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
