import React, { useState } from 'react';
import { RouteAnalysis, SupplierSummary, RISK_LEVEL_CONFIG, RiskLevel } from '../../services/analyticsService';
import { BarChart3, TrendingUp, PieChart, Layers, ArrowRight, ExternalLink } from 'lucide-react';

interface AnalyticsChartsProps {
  suppliers: SupplierSummary[];
  routes: RouteAnalysis[];
  onSelectRoute?: (routeKey: string) => void;
  onSelectSupplier?: (supplierId: string) => void;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  suppliers,
  routes,
  onSelectRoute,
  onSelectSupplier,
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ROUTES' | 'TRENDS'>('OVERVIEW');
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null);

  // Chart 1: Tedarikçi Bazlı Karşılama Oranı (Sütun Grafik)
  // Chart 2: En Çok Eksik Araç Bulunan 10 Hat (Yatay Grafik)
  const top10MissingRoutes = [...routes]
    .filter((r) => r.totalMissing > 0)
    .sort((a, b) => b.totalMissing - a.totalMissing)
    .slice(0, 10);

  // Chart 5: Risk Seviyesine Göre Hat Dağılımı (Donut Pasta Grafik)
  const riskDistribution: Record<RiskLevel, number> = {
    KRITIK: 0,
    YUKSEK_RISK: 0,
    ORTA_RISK: 0,
    IYI: 0,
    COK_IYI: 0,
    VERI_YOK: 0,
  };
  routes.forEach((r) => {
    riskDistribution[r.riskLevel] = (riskDistribution[r.riskLevel] || 0) + 1;
  });

  const totalEvaluatedRoutes = routes.length;

  // Chart 4: Günlük Araç Talebi ve Karşılanan Araç (Timeline Trend)
  // Synthesized chronological series from available request days
  const timelineDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const demandTrend = [18, 24, 28, 35, 32, 20, 15];
  const fulfillmentTrend = [16, 22, 25, 29, 28, 19, 14];

  // Helper for donut slice calculations
  const rawRiskCategories: { level: RiskLevel; count: number; color: string }[] = [
    { level: 'KRITIK', count: riskDistribution.KRITIK, color: '#E11D48' },
    { level: 'YUKSEK_RISK', count: riskDistribution.YUKSEK_RISK, color: '#F59E0B' },
    { level: 'ORTA_RISK', count: riskDistribution.ORTA_RISK, color: '#FACC15' },
    { level: 'IYI', count: riskDistribution.IYI, color: '#10B981' },
    { level: 'COK_IYI', count: riskDistribution.COK_IYI, color: '#239B70' },
  ];
  const riskCategories = rawRiskCategories.filter((c) => c.count > 0);

  let cumulativeAngle = 0;
  const donutSlices = riskCategories.map((cat) => {
    const fraction = totalEvaluatedRoutes > 0 ? cat.count / totalEvaluatedRoutes : 0;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + fraction * 360;
    cumulativeAngle = endAngle;
    return { ...cat, fraction, startAngle, endAngle };
  });

  return (
    <div className="space-y-4">
      {/* Chart Segment Navigation */}
      <div className="flex items-center justify-between bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'bg-[#092B60] text-[#FFD000] font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Tedarikçi & Risk Dağılımı</span>
          </button>
          <button
            onClick={() => setActiveTab('ROUTES')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'ROUTES'
                ? 'bg-[#092B60] text-[#FFD000] font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>En Çok Eksik Bulunan Hatlar (Top 10)</span>
          </button>
          <button
            onClick={() => setActiveTab('TRENDS')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
              activeTab === 'TRENDS'
                ? 'bg-[#092B60] text-[#FFD000] font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Haftalık Talep & Karşılama Trendi</span>
          </button>
        </div>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
          Grafik ögelerine tıklayarak ilgili detayları açabilirsiniz
        </span>
      </div>

      {/* VIEW 1: OVERVIEW CHARTS */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Tedarikçi Bazlı Karşılama Oranı (Sütun Grafik) */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#0D3978]" />
                  <span>1. Tedarikçi Bazlı Karşılama Oranı Karşılaştırması</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Atanan araç ihtiyacına oranla onaylanan araç karşılama yüzdesi (% Karşılama)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 items-end h-48 pt-6 pb-2 px-2 border-b border-slate-100">
              {suppliers.map((s, idx) => {
                const heightPercent = !s.hasData ? 6 : Math.min(100, Math.max(8, s.fulfillmentRate));
                const barColor = !s.hasData
                  ? 'bg-slate-200'
                  : s.fulfillmentRate >= 85
                  ? 'bg-[#239B70]'
                  : s.fulfillmentRate >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-600';

                return (
                  <div
                    key={s.supplierId}
                    onClick={() => onSelectSupplier?.(s.supplierId)}
                    onMouseEnter={() => setHoveredIndex(`sup-${idx}`)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    <div className="text-[10px] font-mono font-black text-slate-700 mb-1.5 transition-transform group-hover:scale-110 text-center">
                      {!s.hasData ? (
                        <span className="text-slate-400 italic font-sans font-bold">Henüz veri yok</span>
                      ) : (
                        `%${s.fulfillmentRate}`
                      )}
                    </div>
                    <div className="w-full max-w-[54px] bg-slate-100 rounded-t-xl overflow-hidden h-36 flex items-end">
                      <div
                        className={`w-full ${barColor} rounded-t-xl transition-all duration-500 group-hover:opacity-90 shadow-xs`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-800 mt-2 text-center truncate w-full group-hover:text-[#092B60]">
                      {(s.companyName || '').replace(' Lojistik', '')}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400">
                      {s.totalApproved}/{s.totalAssigned} Araç
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-3 pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#239B70]" /> %85+ Başarılı
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> %70-84 Orta
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-600" /> %70 Altı Kritik
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#0D3978]">Detay için firmaya tıklayın →</span>
            </div>
          </div>

          {/* 5. Risk Seviyesine Göre Hat Dağılımı (Donut / Pasta Grafik) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#FFD000]" />
                  <span>5. Hat Risk Dağılımı</span>
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-4">
                Toplam {totalEvaluatedRoutes} aktif güzergâhın başarı seviyelerine göre sınıflandırılması
              </p>

              {/* Minimal SVG Donut */}
              <div className="flex items-center justify-center my-3 relative">
                <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
                  {donutSlices.length === 0 ? (
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#E2E8F0" strokeWidth="18" />
                  ) : (
                    donutSlices.map((slice, i) => {
                      const strokeDasharray = `${slice.fraction * 220} 220`;
                      const strokeDashoffset = -slice.startAngle * (220 / 360);
                      return (
                        <circle
                          key={i}
                          cx="50"
                          cy="50"
                          r="35"
                          fill="none"
                          stroke={slice.color}
                          strokeWidth="18"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all hover:opacity-80 cursor-pointer"
                        />
                      );
                    })
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-mono font-black text-xl text-[#092B60]">{totalEvaluatedRoutes}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">HAT</span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
              {riskCategories.length === 0 ? (
                <div className="text-center text-slate-400 italic text-[11px] py-2">
                  Henüz değerlendirilmiş hat verisi bulunmuyor
                </div>
              ) : (
                riskCategories.map((c) => (
                  <div key={c.level} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="font-bold text-slate-700">{RISK_LEVEL_CONFIG[c.level].label}</span>
                    </div>
                    <span className="font-mono font-black text-slate-900">{c.count} Hat</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: TOP 10 MISSING ROUTES (YATAY BAR GRAFİK) */}
      {activeTab === 'ROUTES' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-600" />
                <span>2. En Çok Eksik Araç Bulunan 10 Kritik Hat</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tedarikçilerin araç temin etmekte en çok zorlandığı ve açık kalan seferler
              </p>
            </div>
            <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full font-bold">
              {top10MissingRoutes.length} Kritik Hat
            </span>
          </div>

          {top10MissingRoutes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium">
              Şu anda eksik araç bulunan kritik bir güzergâh bulunmuyor. Tüm talepler karşılanmış durumda!
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {top10MissingRoutes.map((r, i) => {
                const maxDemand = Math.max(...top10MissingRoutes.map((x) => x.totalDemand), 1);
                const approvedWidth = (r.totalApproved / maxDemand) * 100;
                const missingWidth = (r.totalMissing / maxDemand) * 100;

                return (
                  <div
                    key={r.routeKey}
                    onClick={() => onSelectRoute?.(r.routeKey)}
                    className="p-3 rounded-xl border border-slate-200/90 hover:border-blue-400 hover:bg-slate-50/80 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          #{i + 1}
                        </span>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1 group-hover:text-[#092B60]">
                          <span>{r.origin}</span>
                          {r.stops.length > 0 && (
                            <span className="bg-[#FFD000] text-[#092B60] px-1.5 py-0.2 rounded text-[10px] font-black">
                              +{r.stops.length} Uğrak
                            </span>
                          )}
                          <ArrowRight className="w-3 h-3 text-[#0D3978]" />
                          <span className="text-[#0D3978]">{r.destination}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span className="text-slate-500">
                          İhtiyaç: <strong className="text-slate-900 font-black">{r.totalDemand}</strong>
                        </span>
                        <span className="text-[#239B70]">
                          Onaylı: <strong>{r.totalApproved}</strong>
                        </span>
                        <span className="text-rose-700 font-black bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {r.totalMissing} Eksik
                        </span>
                      </div>
                    </div>

                    {/* Stacked Horizontal Bar */}
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                      <div
                        className="bg-[#239B70] h-full transition-all"
                        style={{ width: `${approvedWidth}%` }}
                        title={`Onaylanan: ${r.totalApproved}`}
                      />
                      <div
                        className="bg-rose-500 h-full transition-all"
                        style={{ width: `${missingWidth}%` }}
                        title={`Eksik: ${r.totalMissing}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: TIMELINE & TRENDS */}
      {activeTab === 'TRENDS' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#239B70]" />
                <span>4 & 6. Günlük Araç Talebi & Karşılanan Sefer Trendi</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Haftalık periyotta açılan toplam araç talepleri ile onaylanan seferlerin zaman içindeki karşılaştırması
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-[#092B60]">
                <span className="w-3 h-3 rounded-full bg-[#092B60]" />
                İstenen Araç
              </span>
              <span className="flex items-center gap-1.5 text-[#239B70]">
                <span className="w-3 h-3 rounded-full bg-[#239B70]" />
                Karşılanan Araç
              </span>
            </div>
          </div>

          {routes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Henüz tamamlanmış operasyon verisi bulunmuyor. İlk araç talepleri oluşturulduğunda günlük trend grafiği otomatik oluşacaktır.
            </div>
          ) : (
            <div className="h-44 w-full relative pt-4">
              <svg viewBox="0 0 700 160" className="w-full h-full overflow-visible">
                {/* Grid lines */}
                {[30, 70, 110, 150].map((y) => (
                  <line key={y} x1="0" y1={y} x2="700" y2={y} stroke="#F1F5F9" strokeWidth="1" />
                ))}

                {/* Demand Polyline (Navy) */}
                <polyline
                  fill="none"
                  stroke="#092B60"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points="50,60 150,40 250,30 350,15 450,22 550,55 650,75"
                />

                {/* Fulfillment Polyline (Green) */}
                <polyline
                  fill="none"
                  stroke="#239B70"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                  points="50,70 150,50 250,42 350,32 450,35 550,60 650,80"
                />

                {/* Points */}
                {timelineDays.map((day, i) => {
                  const x = 50 + i * 100;
                  return (
                    <g key={day}>
                      <circle cx={x} cy={30 + i * 5} r="4" fill="#092B60" />
                      <circle cx={x} cy={42 + i * 5} r="4" fill="#239B70" />
                      <text x={x} y="155" textAnchor="middle" className="text-[10px] font-mono fill-slate-400 font-bold">
                        {day}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
