import React, { useState, useMemo } from 'react';
import {
  SupplierSummary,
  RouteAnalysis,
  RISK_LEVEL_CONFIG,
  DateFilterConfig,
  computeAnalytics,
} from '../../services/analyticsService';
import { SupplierDetailModal } from './SupplierDetailModal';
import { RouteDetailModal } from './RouteDetailModal';
import { AnalyticsCharts } from './AnalyticsCharts';
import { ExcelExportModal } from './ExcelExportModal';
import { VehicleRequest, RequestAssignment, Vehicle, Supplier, Facility } from '../../types';
import {
  FileSpreadsheet,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  BarChart3,
  MapPin,
} from 'lucide-react';

interface SupplierPerformanceViewProps {
  suppliers: SupplierSummary[];
  routes: RouteAnalysis[];
  allRequests: VehicleRequest[];
  allVehicles: Vehicle[];
  allAssignments: RequestAssignment[];
  allSuppliersList: Supplier[];
  facilities?: Facility[];
  onNavigateToRequest?: (reqId: string) => void;
}

export const SupplierPerformanceView: React.FC<SupplierPerformanceViewProps> = ({
  allRequests,
  allVehicles,
  allAssignments,
  allSuppliersList,
  facilities = [],
  onNavigateToRequest,
}) => {
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [dateConfig, setDateConfig] = useState<DateFilterConfig>({ range: 'ALL' });
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [routeSearchTerm, setRouteSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');

  // Compute analytics dynamically based on current dateConfig
  const analytics = useMemo(() => {
    return computeAnalytics(
      allRequests,
      allAssignments,
      allVehicles,
      allSuppliersList,
      dateConfig
    );
  }, [allRequests, allAssignments, allVehicles, allSuppliersList, dateConfig]);

  const { routes, suppliers, alerts } = analytics;

  const selectedRouteObj = routes.find((r) => r.routeKey === selectedRouteKey) || null;

  const filteredSuppliers = suppliers.filter(
    (s) =>
      (s.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      const matchesSearch =
        r.routeKey.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
        r.origin.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
        r.destination.toLowerCase().includes(routeSearchTerm.toLowerCase()) ||
        r.stops.some((s) => s.toLowerCase().includes(routeSearchTerm.toLowerCase()));
      const matchesRisk = riskFilter === 'ALL' || r.riskLevel === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [routes, routeSearchTerm, riskFilter]);

  const handleApplyCustomDate = () => {
    if (customStart && customEnd) {
      setDateConfig({
        range: 'CUSTOM',
        customStartDate: customStart,
        customEndDate: customEnd,
      });
      setShowCustomDate(false);
    }
  };

  return (
    <div className="space-y-6 text-xs font-sans">
      {/* 1. TOP BANNER & DATE FILTER */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#092B60] tracking-tight">
              Tedarikçi Performans ve Hat Analiz Merkezi
            </h1>
            <span className="bg-[#FFD000] text-[#092B60] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              STRATEJİK ANALİTİK
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {suppliers.length} bağımsız lojistik çözüm ortağının hat bazlı karşılama gücü, eksik araç analizi, güzergâh zorlukları ve başarı karnesi
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'ALL', label: 'Tüm Zamanlar' },
                { id: 'TODAY', label: 'Bugün' },
                { id: 'LAST_7_DAYS', label: 'Son 7 Gün' },
                { id: 'LAST_30_DAYS', label: 'Son 30 Gün' },
                { id: 'THIS_MONTH', label: 'Bu Ay' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setShowCustomDate(false);
                  setDateConfig({ range: t.id });
                }}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                  dateConfig.range === t.id
                    ? 'bg-white text-[#092B60] shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustomDate(!showCustomDate)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                dateConfig.range === 'CUSTOM' || showCustomDate
                  ? 'bg-white text-[#092B60] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Özel Tarih
            </button>
          </div>

          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98 shrink-0"
            title="Tedarikçi ve hat analitiğini 8 sekmeli Excel (.xlsx) olarak dışa aktar"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Excel'e Aktar</span>
          </button>
        </div>
      </div>

      {showCustomDate && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold">Başlangıç:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold">Bitiş:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold"
            />
          </div>
          <button
            onClick={handleApplyCustomDate}
            className="bg-[#092B60] text-white font-bold px-3 py-1 rounded-lg text-xs hover:bg-[#0D3978]"
          >
            Uygula
          </button>
        </div>
      )}

      {/* 2. DÖRT TEDARİKÇİ KARŞILAŞTIRMALI PERFORMANS TABLOSU */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex items-center justify-between border-b border-[#0D3978]">
          <h2 className="font-black text-sm text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#FFD000]" />
            <span>4 Tedarikçi Karşılaştırmalı Performans Karnesi</span>
          </h2>
          <span className="text-[11px] text-blue-200 font-medium">
            Ayrıntılı hat kırılımını ve zorlandığı güzergâhları görmek için satıra tıklayın
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
              <tr>
                <th className="px-5 py-3">Tedarikçi Firma</th>
                <th className="px-4 py-3 text-center">Atanan İhtiyaç</th>
                <th className="px-4 py-3 text-center">Bildirilen Araç</th>
                <th className="px-4 py-3 text-center">Onaylanan Araç</th>
                <th className="px-4 py-3 text-center">Tesise Ulaşan</th>
                <th className="px-4 py-3 text-center">Eksik Araç</th>
                <th className="px-4 py-3 text-center">Karşılama Oranı</th>
                <th className="px-4 py-3">En Çok Zorlandığı Hat</th>
                <th className="px-4 py-3 text-right">Risk Seviyesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((sup) => {
                const riskCfg = RISK_LEVEL_CONFIG[sup.overallRiskLevel];
                const hardest = sup.hardestRoutes[0];

                return (
                  <tr
                    key={sup.supplierId}
                    onClick={() => setSelectedSupplier(sup)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-4 font-bold text-[#092B60]">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#092B60] shrink-0" />
                        <div>
                          <div className="text-xs font-black text-[#092B60] group-hover:underline">
                            {sup.companyName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                            {sup.contactPerson} • {sup.phone}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center font-mono font-black text-slate-800 text-sm">
                      {sup.totalAssigned}
                    </td>

                    <td className="px-4 py-4 text-center font-mono font-bold text-slate-700 text-sm">
                      {sup.totalReported}
                    </td>

                    <td className="px-4 py-4 text-center font-mono font-black text-[#239B70] text-sm">
                      {sup.totalApproved}
                    </td>

                    <td className="px-4 py-4 text-center font-mono font-black text-emerald-800 text-sm">
                      {sup.totalArrived}
                    </td>

                    <td className="px-4 py-4 text-center font-mono font-black text-rose-700 text-sm">
                      {sup.totalMissing > 0 ? (
                        <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                          {sup.totalMissing}
                        </span>
                      ) : (
                        <span className="text-emerald-700">0</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {!sup.hasData ? (
                        <span className="text-slate-400 font-bold text-xs italic">
                          Henüz veri yok
                        </span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="font-mono font-black text-sm text-[#092B60]">
                            %{sup.fulfillmentRate}
                          </span>
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                sup.fulfillmentRate >= 85
                                  ? 'bg-[#239B70]'
                                  : sup.fulfillmentRate >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-rose-600'
                              }`}
                              style={{ width: `${Math.min(100, sup.fulfillmentRate)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {!sup.hasData ? (
                        <span className="text-slate-400 text-[10px] italic">Henüz veri yok</span>
                      ) : hardest ? (
                        <div className="text-[11px] font-bold text-slate-800 truncate max-w-[200px]">
                          <span className="text-rose-700 font-mono font-black">
                            [{hardest.missing} Eksik]
                          </span>{' '}
                          {hardest.routeKey}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Tedarik Güçlüğü Yok</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] ${riskCfg.badgeClass}`}>
                        {!sup.hasData ? 'Henüz Veri Yok' : riskCfg.label.split(' ')[0]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. GELİŞMİŞ GRAFİKLER SÜİTİ (Section 8: Interactive Charts) */}
      <AnalyticsCharts
        suppliers={suppliers}
        routes={routes}
        onSelectRoute={(rk) => setSelectedRouteKey(rk)}
        onSelectSupplier={(sid) => {
          const sup = suppliers.find((s) => s.supplierId === sid);
          if (sup) setSelectedSupplier(sup);
        }}
      />

      {/* 4. HANGİ TEDARİKÇİ HANGİ HATTI BULAMIYOR? (Tedarikçi Hat Analizi Matrisi) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#0D3978]">
          <div>
            <h2 className="font-black text-sm text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-[#FFD000]" />
              <span>Hangi Tedarikçi Hangi Hattı Bulamıyor? (Tedarik Güçlüğü Matrisi)</span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Tedarikçilerin araç bulmakta en çok zorlandığı spesifik rotalar ve eksik kalan seferler
            </p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {suppliers.map((s) => (
            <div
              key={s.supplierId}
              className="bg-slate-50/80 rounded-2xl border border-slate-200/90 p-4 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#092B60]" />
                    <span className="font-black text-xs text-[#092B60] truncate">{s.companyName}</span>
                  </div>
                  <button
                    onClick={() => setSelectedSupplier(s)}
                    className="text-[10px] font-bold text-[#0D3978] hover:underline"
                  >
                    Detay →
                  </button>
                </div>

                {s.hardestRoutes.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 font-medium text-[11px]">
                    Bu tedarikçi için eksik araç tespit edilen hat bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {s.hardestRoutes.slice(0, 3).map((hr) => {
                      const hrRisk = RISK_LEVEL_CONFIG[hr.riskLevel];
                      return (
                        <div
                          key={hr.routeKey}
                          onClick={() => setSelectedRouteKey(hr.routeKey)}
                          className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between"
                        >
                          <div className="truncate pr-1.5">
                            <div className="font-bold text-slate-900 text-[11px] truncate">
                              {hr.routeKey}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Atanan: {hr.assigned} • Onaylı: {hr.approved}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="bg-rose-50 text-rose-700 font-mono font-black text-[10px] px-1.5 py-0.5 rounded border border-rose-200">
                              {hr.missing} Eksik
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] ${hrRisk.badgeClass}`}>
                              %{hr.fulfillmentRate}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 text-right">
                <button
                  onClick={() => setSelectedSupplier(s)}
                  className="text-[11px] font-bold text-[#0D3978] hover:underline inline-flex items-center gap-1"
                >
                  <span>Tam Karnesini Aç</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. GÜZERZÂH RISK VE BAŞARI KARNESİ TABLOSU */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0D3978]">
          <div>
            <h2 className="font-black text-sm text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FFD000]" />
              <span>Güzergâh Risk & Başarı Karnesi ({filteredRoutes.length} Hat)</span>
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Tüm hatların karşılama oranları, risk seviyeleri ve detaylı tedarikçi performansları
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Hat veya şehir ara..."
              value={routeSearchTerm}
              onChange={(e) => setRouteSearchTerm(e.target.value)}
              className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold focus:outline-none placeholder:text-slate-400"
            />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-1.5 bg-white text-slate-900 rounded-xl text-xs font-bold focus:outline-none"
            >
              <option value="ALL">Tüm Risk Seviyeleri</option>
              <option value="KRITIK">Kritik Risk (&lt;%50)</option>
              <option value="YUKSEK_RISK">Yüksek Risk (%50-69)</option>
              <option value="ORTA_RISK">Orta Risk (%70-84)</option>
              <option value="IYI">İyi (%85-94)</option>
              <option value="COK_IYI">Çok İyi (%95-100)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
              <tr>
                <th className="px-5 py-3">Güzergâh (Çıkış → Uğraklar → Varış)</th>
                <th className="px-4 py-3 text-center">Talep Sayısı</th>
                <th className="px-4 py-3 text-center">Araç İhtiyacı</th>
                <th className="px-4 py-3 text-center">Bildirilen</th>
                <th className="px-4 py-3 text-center">Onaylanan</th>
                <th className="px-4 py-3 text-center">Eksik Kalan</th>
                <th className="px-4 py-3 text-center">Karşılama Oranı</th>
                <th className="px-5 py-3 text-right">Risk Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoutes.map((r) => {
                const riskCfg = RISK_LEVEL_CONFIG[r.riskLevel];

                return (
                  <tr
                    key={r.routeKey}
                    onClick={() => setSelectedRouteKey(r.routeKey)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 flex items-center flex-wrap gap-1.5 group-hover:text-[#092B60]">
                        <span>{r.origin}</span>
                        {r.stops.map((st, i) => (
                          <React.Fragment key={i}>
                            <ArrowRight className="w-3 h-3 text-[#0D3978] shrink-0" />
                            <span className="bg-[#FFD000] text-[#092B60] px-1.5 py-0.2 rounded text-[10px] font-black shadow-2xs">
                              {st}
                            </span>
                          </React.Fragment>
                        ))}
                        <ArrowRight className="w-3 h-3 text-[#0D3978] shrink-0" />
                        <span className="text-[#0D3978] font-black">{r.destination}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700">
                      {r.totalRequests}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-black text-slate-900">
                      {r.totalDemand}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700">
                      {r.totalReported}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-black text-[#239B70]">
                      {r.totalApproved}
                    </td>

                    <td className="px-4 py-3.5 text-center font-mono font-black text-rose-700">
                      {r.totalMissing > 0 ? (
                        <span className="bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {r.totalMissing}
                        </span>
                      ) : (
                        <span className="text-emerald-700">0</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono font-black text-[#092B60]">
                          %{r.fulfillmentRate}
                        </span>
                        <div className="w-14 bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.fulfillmentRate >= 85
                                ? 'bg-[#239B70]'
                                : r.fulfillmentRate >= 70
                                ? 'bg-amber-500'
                                : 'bg-rose-600'
                            }`}
                            style={{ width: `${Math.min(100, r.fulfillmentRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] ${riskCfg.badgeClass}`}>
                        {riskCfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredRoutes.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    Kriterlere uygun güzergâh bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedRouteObj && (
        <RouteDetailModal
          route={selectedRouteObj}
          allRequests={allRequests}
          allVehicles={allVehicles}
          onClose={() => setSelectedRouteKey(null)}
          onNavigateToRequest={onNavigateToRequest}
        />
      )}

      {selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onSelectRoute={(rk) => setSelectedRouteKey(rk)}
        />
      )}

      {/* Excel Export Modal */}
      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        requests={allRequests}
        assignments={allAssignments}
        vehicles={allVehicles}
        suppliers={allSuppliersList}
        facilities={facilities}
      />
    </div>
  );
};
