import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  X,
  Filter,
  Download,
  Calendar,
  Building2,
  Truck,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { VehicleRequest, RequestAssignment, Vehicle, Supplier, Facility } from '../../types';
import {
  ExcelExportFilterOptions,
  getDateRangeBounds,
  generateAndDownloadKPIExcel,
} from '../../services/excelExportService';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  requests: VehicleRequest[];
  assignments: RequestAssignment[];
  vehicles: Vehicle[];
  suppliers: Supplier[];
  facilities: Facility[];
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  requests,
  assignments,
  vehicles,
  suppliers,
  facilities,
}) => {
  const [dateRange, setDateRange] = useState<ExcelExportFilterOptions['dateRange']>('TODAY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('ALL');
  const [originFacility, setOriginFacility] = useState('ALL');
  const [destinationFacility, setDestinationFacility] = useState('ALL');
  const [vehicleType, setVehicleType] = useState('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Active facility list
  const activeFacilities = useMemo(() => {
    return facilities.filter((f) => f.active !== false);
  }, [facilities]);

  // Preview counts based on current filters
  const previewStats = useMemo(() => {
    const { start, end } = getDateRangeBounds(dateRange, startDate, endDate);

    const filteredReqs = requests.filter((r) => {
      const reqDate = r.requiredDate || (r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split('T')[0] : '');
      if (reqDate && (reqDate < start || reqDate > end)) return false;
      if (originFacility !== 'ALL' && r.originFacility !== originFacility) return false;
      if (destinationFacility !== 'ALL' && r.destination !== destinationFacility) return false;
      if (vehicleType !== 'ALL' && !r.vehicleType.toLowerCase().includes(vehicleType.toLowerCase())) return false;
      if (supplierId !== 'ALL') {
        const hasAssignment = assignments.some(
          (a) => a.requestId === r.id && a.supplierId === supplierId && (a.assignedQuantity > 0 || a.offeredQuantity > 0)
        );
        if (!hasAssignment) return false;
      }
      return true;
    });

    const totalVehiclesNeeded = filteredReqs.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
    const reqIds = new Set(filteredReqs.map((r) => r.id));
    const matchingVehicles = vehicles.filter((v) => {
      if (!reqIds.has(v.requestId)) return false;
      if (supplierId !== 'ALL' && v.supplierId !== supplierId) return false;
      return true;
    });

    return {
      requestCount: filteredReqs.length,
      vehicleNeed: totalVehiclesNeeded,
      reportedVehicles: matchingVehicles.length,
      approvedVehicles: matchingVehicles.filter((v) =>
        ['APPROVED', 'TEYIT_EDILDI', 'ON_THE_WAY', 'YOLDA', 'ARRIVED', 'TESISE_GIRIS_YAPTI', 'GECIKTI'].includes(v.status)
      ).length,
    };
  }, [
    requests,
    assignments,
    vehicles,
    dateRange,
    startDate,
    endDate,
    supplierId,
    originFacility,
    destinationFacility,
    vehicleType,
  ]);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    try {
      generateAndDownloadKPIExcel({
        filters: {
          dateRange,
          startDate,
          endDate,
          supplierId,
          originFacility,
          destinationFacility,
          vehicleType,
        },
        requests,
        assignments,
        vehicles,
        suppliers,
        facilities: activeFacilities,
      });
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Excel dışa aktarım hatası:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#092B60] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-[#A7F36B]" />
            </div>
            <div>
              <h3 className="text-lg font-bold">KPI Raporunu Excel'e Aktar (.xlsx)</h3>
              <p className="text-xs text-blue-100">8 Sayfalı Kapsamlı Kurumsal Rapor Paketi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Included Sheets Info Banner */}
          <div className="bg-[#F4F7FC] border border-[#CBD5E1] rounded-xl p-3.5 text-xs text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-[#092B60] mb-1.5">
              <Layers className="w-4 h-4 text-[#0D3978]" />
              <span>Oluşturulacak Excel Çalışma Sayfaları (8 Ayrı Sekme):</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-medium text-slate-600">
              <span className="bg-white px-2 py-1 rounded border border-slate-200">1. Genel KPI</span>
              <span className="bg-white px-2 py-1 rounded border border-slate-200">2. Araç Talepleri</span>
              <span className="bg-white px-2 py-1 rounded border border-slate-200">3. Tedarikçi Perf.</span>
              <span className="bg-white px-2 py-1 rounded border border-slate-200">4. Hat Analizi</span>
              <span className="bg-white px-2 py-1 rounded border border-slate-200">5. Eksik Araçlar</span>
              <span className="bg-white px-2 py-1 rounded border border-slate-200">6. Onaylananlar</span>
              <span className="bg-white px-2 py-1 rounded border border-slate-200">7. Gecikenler</span>
              <span className="bg-white px-2 py-1 rounded border border-slate-200">8. Tesis Analizi</span>
            </div>
          </div>

          {/* Tarih Aralığı */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0D3978]" />
              Rapor Tarih Kapsamı
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {[
                { id: 'TODAY', label: 'Bugün' },
                { id: 'LAST_7_DAYS', label: 'Son 7 Gün' },
                { id: 'LAST_30_DAYS', label: 'Son 30 Gün' },
                { id: 'THIS_MONTH', label: 'Bu Ay' },
                { id: 'LAST_MONTH', label: 'Geçen Ay' },
                { id: 'CUSTOM', label: 'Özel Aralık' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateRange(item.id as any)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-all text-center ${
                    dateRange === item.id
                      ? 'bg-[#092B60] text-white border-[#092B60] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {dateRange === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 mb-1">Başlangıç Tarihi</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 mb-1">Bitiş Tarihi</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filtreler: Tedarikçi, Tesis, Araç Tipi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tedarikçi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#0D3978]" />
                Tedarikçi Kapsamı
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-[#092B60] focus:border-[#092B60]"
              >
                <option value="ALL">Tüm Tedarikçiler (Tümü Dahil)</option>
                {suppliers.map((s) => (
                  <option key={`exp-sup-${s.id}`} value={s.id}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Araç Tipi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#0D3978]" />
                Araç Tipi
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-[#092B60] focus:border-[#092B60]"
              >
                <option value="ALL">Tüm Araç Tipleri (Tümü Dahil)</option>
                <option value="TIR">TIR (Tenteli 13.60 / Kapalı Kasa)</option>
                <option value="Kamyon">Kamyon (10 Teker / Kırkayak)</option>
                <option value="Kamyonet">Kamyonet / Panelvan</option>
              </select>
            </div>

            {/* Çıkış Tesisi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#0D3978]" />
                Çıkış Tesisi
              </label>
              <select
                value={originFacility}
                onChange={(e) => setOriginFacility(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-[#092B60] focus:border-[#092B60]"
              >
                <option value="ALL">Tüm Çıkış Tesisleri</option>
                {activeFacilities.map((f) => (
                  <option key={`origin-${f.id}`} value={f.facilityName}>
                    {f.facilityName} ({f.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Varış Tesisi */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#0D3978]" />
                Varış Tesisi
              </label>
              <select
                value={destinationFacility}
                onChange={(e) => setDestinationFacility(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-[#092B60] focus:border-[#092B60]"
              >
                <option value="ALL">Tüm Varış Tesisleri</option>
                {activeFacilities.map((f) => (
                  <option key={`dest-${f.id}`} value={f.facilityName}>
                    {f.facilityName} ({f.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dinamik Veri Özeti (Preview) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Seçilen Kapsamdaki Aktarılacak Veri Özeti
            </span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="block text-lg font-black text-[#092B60]">{previewStats.requestCount}</span>
                <span className="block text-[10px] text-slate-500 font-semibold">Talep Sayısı</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="block text-lg font-black text-[#0D3978]">{previewStats.vehicleNeed}</span>
                <span className="block text-[10px] text-slate-500 font-semibold">Araç İhtiyacı</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="block text-lg font-black text-amber-600">{previewStats.reportedVehicles}</span>
                <span className="block text-[10px] text-slate-500 font-semibold">Bildirilen</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="block text-lg font-black text-emerald-600">{previewStats.approvedVehicles}</span>
                <span className="block text-[10px] text-slate-500 font-semibold">Onaylanan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Vazgeç
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all ${
              exportSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-[#239B70] hover:bg-[#1E835E] text-white active:scale-95'
            }`}
          >
            {exportSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Excel Dosyası İndirildi!</span>
              </>
            ) : isExporting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Oluşturuluyor...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Excel Raporunu İndir (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
