import React from 'react';
import { RouteAnalysis, RISK_LEVEL_CONFIG } from '../../services/analyticsService';
import { VehicleRequest, Vehicle } from '../../types';
import {
  X,
  MapPin,
  ArrowRight,
  Truck,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';

interface RouteDetailModalProps {
  route: RouteAnalysis | null;
  allRequests: VehicleRequest[];
  allVehicles: Vehicle[];
  onClose: () => void;
  onNavigateToRequest?: (reqId: string) => void;
}

export const RouteDetailModal: React.FC<RouteDetailModalProps> = ({
  route,
  allRequests,
  allVehicles,
  onClose,
  onNavigateToRequest,
}) => {
  if (!route) return null;

  const riskCfg = RISK_LEVEL_CONFIG[route.riskLevel];

  // Past requests on this specific route
  const routeRequests = allRequests.filter((r) => route.requestIds.includes(r.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] ${riskCfg.badgeClass}`}>
                {riskCfg.label}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {route.totalRequests} Talep Kaydı
              </span>
            </div>
            <h2 className="text-base font-black text-[#092B60] mt-1 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#0D3978]" />
              <span>{route.origin}</span>
              {route.stops.map((st, i) => (
                <React.Fragment key={i}>
                  <ArrowRight className="w-4 h-4 text-[#FFD000]" />
                  <span className="bg-[#FFD000] text-[#092B60] px-2 py-0.5 rounded text-[11px] font-black">
                    {st}
                  </span>
                </React.Fragment>
              ))}
              <ArrowRight className="w-4 h-4 text-[#0D3978]" />
              <span className="text-[#0D3978]">{route.destination}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Araç Tipi: <strong className="text-slate-800">{route.vehicleType || 'Standart TIR'}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Route Level Key Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Toplam İhtiyaç</span>
            <span className="text-xl font-mono font-black text-[#092B60] block mt-0.5">
              {route.totalDemand}
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Bildirilen</span>
            <span className="text-xl font-mono font-bold text-slate-800 block mt-0.5">
              {route.totalReported}
            </span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Onaylanan</span>
            <span className="text-xl font-mono font-black text-[#239B70] block mt-0.5">
              {route.totalApproved}
            </span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Tesise Giriş</span>
            <span className="text-xl font-mono font-black text-emerald-900 block mt-0.5">
              {route.totalArrived}
            </span>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase block">Kalan Eksik</span>
            <span className="text-xl font-mono font-black text-rose-700 block mt-0.5">
              {route.totalMissing}
            </span>
          </div>
        </div>

        {/* 1. Tedarikçilerin Bu Hattaki Karşılaştırmalı Performansı */}
        <div>
          <h3 className="font-black text-xs text-[#092B60] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#0D3978]" />
            <span>Bu Hattı Karşılayan Tedarikçiler & Başarı Karnesi</span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0D3978] text-white uppercase text-[9px] font-black">
                <tr>
                  <th className="px-3.5 py-2.5">Tedarikçi Firma</th>
                  <th className="px-3 py-2.5 text-center">Atanan İhtiyaç</th>
                  <th className="px-3 py-2.5 text-center">Bildirdiği</th>
                  <th className="px-3 py-2.5 text-center">Onaylanan</th>
                  <th className="px-3 py-2.5 text-center">Tesise Giriş</th>
                  <th className="px-3 py-2.5 text-center">Eksik</th>
                  <th className="px-3 py-2.5 text-center">Karşılama %</th>
                  <th className="px-3.5 py-2.5 text-right">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {route.supplierBreakdown.map((sb) => {
                  const sbRisk = RISK_LEVEL_CONFIG[sb.riskLevel];
                  return (
                    <tr key={sb.supplierId} className="hover:bg-slate-50/80">
                      <td className="px-3.5 py-2.5 font-bold text-[#092B60]">
                        {sb.supplierName}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-slate-800">
                        {sb.assignedDemand}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">
                        {sb.reportedCount}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-[#239B70]">
                        {sb.approvedCount}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-emerald-800">
                        {sb.arrivedCount}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-rose-700">
                        {sb.missingCount}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-black text-slate-900">
                        %{sb.fulfillmentRate}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${sbRisk.badgeClass}`}>
                          {sbRisk.label.split(' ')[0]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Talep Numarası Bazında Geçmiş Talepler */}
        <div>
          <h3 className="font-black text-xs text-[#092B60] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-[#0D3978]" />
            <span>Bu Hattaki Geçmiş Araç Talepleri ({routeRequests.length})</span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#092B60] text-white uppercase text-[9px] font-black sticky top-0">
                <tr>
                  <th className="px-3 py-2">Talep No</th>
                  <th className="px-3 py-2">Termin Tarihi</th>
                  <th className="px-3 py-2 text-center">İstenen Araç</th>
                  <th className="px-3 py-2 text-center">Dağıtım Modu</th>
                  <th className="px-3 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routeRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-mono font-black text-[#092B60]">
                      {req.requestNumber}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {req.requiredDate} {req.requiredTime || ''}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-black text-slate-800">
                      {req.totalQuantity}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-[11px] text-slate-600">
                      {req.distributionMode === 'MANUAL' ? 'Manuel Kota' : 'Açık Havuz'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {onNavigateToRequest && (
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateToRequest(req.id);
                          }}
                          className="text-[11px] font-bold text-[#0D3978] hover:underline"
                        >
                          Talebe Git →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#092B60] hover:bg-[#0D3978] text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
