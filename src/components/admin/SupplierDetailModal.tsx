import React from 'react';
import { SupplierSummary, RISK_LEVEL_CONFIG } from '../../services/analyticsService';
import { X, Building2, TrendingDown, TrendingUp, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface SupplierDetailModalProps {
  supplier: SupplierSummary | null;
  onClose: () => void;
  onSelectRoute?: (routeKey: string) => void;
}

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier,
  onClose,
  onSelectRoute,
}) => {
  if (!supplier) return null;

  const riskCfg = RISK_LEVEL_CONFIG[supplier.overallRiskLevel];

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
                Yetkili: {supplier.contactPerson} ({supplier.phone})
              </span>
            </div>
            <h2 className="text-lg font-black text-[#092B60] mt-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#0D3978]" />
              <span>{supplier.companyName} – Hat Performans Karnesi</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Atanan İhtiyaç</span>
            <span className="text-xl font-mono font-black text-[#092B60] block mt-0.5">
              {supplier.totalAssigned} Araç
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Bildirilen Araç</span>
            <span className="text-xl font-mono font-bold text-slate-800 block mt-0.5">
              {supplier.totalReported} Araç
            </span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Onaylanan Araç</span>
            <span className="text-xl font-mono font-black text-[#239B70] block mt-0.5">
              {supplier.totalApproved} Araç
            </span>
          </div>
          <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
            <span className="text-[10px] font-bold text-rose-700 uppercase block">Eksik Kalan</span>
            <span className="text-xl font-mono font-black text-rose-700 block mt-0.5">
              {supplier.totalMissing} Araç
            </span>
          </div>
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Karşılama Oranı</span>
            {!supplier.hasData ? (
              <span className="font-bold text-xs text-slate-400 italic">Henüz veri yok</span>
            ) : (
              <span className="font-mono font-black text-base text-[#092B60]">
                %{supplier.fulfillmentRate}
              </span>
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Zamanında Teslim</span>
            {!supplier.hasData ? (
              <span className="font-bold text-xs text-slate-400 italic">Henüz veri yok</span>
            ) : (
              <span className="font-mono font-black text-base text-emerald-800">
                %{supplier.onTimeRate}
              </span>
            )}
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 block uppercase">Revizyon Sayısı</span>
            <span className="font-mono font-black text-base text-amber-800">
              {supplier.revisionCount} Sefer
            </span>
          </div>
        </div>

        {/* Section 4: Hangi Tedarikçi Hangi Hattı Bulamıyor? (En çok zorlandığı 10 güzergâh) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-black text-xs text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span>En Çok Zorlandığı Güzergâhlar (Tedarik Riski Olan Hatlar)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-bold">
              Eksik araç ve karşılama oranına göre sıralanmıştır
            </span>
          </div>

          {supplier.hardestRoutes.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
              Bu tedarikçinin zorlandığı veya eksik bıraktığı bir hat tespit edilmemiştir.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#092B60] text-white uppercase text-[9px] font-black">
                  <tr>
                    <th className="px-3.5 py-2.5">Güzergâh / Hat</th>
                    <th className="px-3 py-2.5 text-center">Atanan</th>
                    <th className="px-3 py-2.5 text-center">Bildirilen</th>
                    <th className="px-3 py-2.5 text-center">Onaylanan</th>
                    <th className="px-3 py-2.5 text-center">Eksik</th>
                    <th className="px-3 py-2.5 text-center">Karşılama %</th>
                    <th className="px-3 py-2.5 text-right">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplier.hardestRoutes.map((hr) => {
                    const hrRisk = RISK_LEVEL_CONFIG[hr.riskLevel];
                    return (
                      <tr
                        key={hr.routeKey}
                        onClick={() => {
                          onClose();
                          onSelectRoute?.(hr.routeKey);
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer group"
                      >
                        <td className="px-3.5 py-2.5 font-bold text-slate-900 group-hover:text-[#092B60]">
                          <div className="flex items-center gap-1">
                            <span>{hr.routeKey}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-[#092B60]" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-slate-800">
                          {hr.assigned}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700">
                          {hr.reported}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-[#239B70]">
                          {hr.approved}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-rose-700">
                          {hr.missing}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-slate-900">
                          %{hr.fulfillmentRate}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${hrRisk.badgeClass}`}>
                            {hrRisk.label.split(' ')[0]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* En Başarılı Olduğu Hatlar */}
        {supplier.bestRoutes.length > 0 && (
          <div>
            <h3 className="font-black text-xs text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#239B70]" />
              <span>En Başarılı Olduğu Hatlar</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {supplier.bestRoutes.map((br) => (
                <div
                  key={br.routeKey}
                  onClick={() => {
                    onClose();
                    onSelectRoute?.(br.routeKey);
                  }}
                  className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs cursor-pointer hover:bg-emerald-50"
                >
                  <span className="font-bold text-emerald-950 truncate max-w-[200px]">{br.routeKey}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-800 font-bold">{br.approved} Araç</span>
                    <span className="bg-[#239B70] text-white px-2 py-0.5 rounded text-[10px] font-black">
                      %{br.fulfillmentRate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
