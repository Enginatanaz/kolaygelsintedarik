import React, { useState } from 'react';
import { RouteAnalysis, SupplierSummary } from '../../services/analyticsService';
import { VehicleRequest, Vehicle, RequestAssignment, Supplier, Facility } from '../../types';
import { FileText, Download, Printer, Filter, CheckCircle2, AlertTriangle, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { ExcelExportModal } from './ExcelExportModal';

interface ReportsViewProps {
  routes: RouteAnalysis[];
  suppliers: SupplierSummary[];
  requests: VehicleRequest[];
  vehicles: Vehicle[];
  assignments?: RequestAssignment[];
  allSuppliers?: Supplier[];
  facilities?: Facility[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  routes,
  suppliers,
  requests,
  vehicles,
  assignments = [],
  allSuppliers = [],
  facilities = [],
}) => {
  const [reportType, setReportType] = useState<'ROUTE' | 'SUPPLIER' | 'DAILY'>('ROUTE');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (reportType === 'ROUTE') {
      csvContent += 'Güzergâh,Çıkış,Varış,İhtiyaç,Bildirilen,Onaylanan,Eksik,Karşılama_Oranı,Risk\n';
      routes.forEach((r) => {
        csvContent += `"${r.routeKey}","${r.origin}","${r.destination}",${r.totalDemand},${r.totalReported},${r.totalApproved},${r.totalMissing},%${r.fulfillmentRate},"${r.riskLevel}"\n`;
      });
    } else {
      csvContent += 'Tedarikçi,Atanan_İhtiyaç,Bildirilen,Onaylanan,Tesise_Giriş,Eksik,Karşılama_Oranı,Zamanında_Oranı\n';
      suppliers.forEach((s) => {
        csvContent += `"${s.companyName}",${s.totalAssigned},${s.totalReported},${s.totalApproved},${s.totalArrived},${s.totalMissing},%${s.fulfillmentRate},%${s.onTimeRate}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tedarik360_${reportType.toLowerCase()}_raporu.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 text-xs font-sans">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#092B60] tracking-tight">Operasyonel Raporlar & İhracat</h1>
            <span className="bg-[#FFD000] text-[#092B60] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              EXCEL / CSV / PDF
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Güzergâh bazlı karşılaştırmalar, tedarikçi kotaları ve performans çıktıları
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors"
            title="8 sekmeli kapsamlı Excel (.xlsx) raporunu oluştur ve indir"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Excel'e Aktar (.xlsx)</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-4 py-2 rounded-xl text-xs font-black shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>CSV Olarak İndir</span>
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Yazdır</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setReportType('ROUTE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            reportType === 'ROUTE'
              ? 'bg-[#092B60] text-[#FFD000] font-black'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Güzergâh & Hat Analiz Raporu ({routes.length} Hat)
        </button>
        <button
          onClick={() => setReportType('SUPPLIER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            reportType === 'SUPPLIER'
              ? 'bg-[#092B60] text-[#FFD000] font-black'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tedarikçi Karşılama Karnesi (4 Firma)
        </button>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {reportType === 'ROUTE' ? (
            <table className="w-full text-left">
              <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black">
                <tr>
                  <th className="px-4 py-3">Güzergâh</th>
                  <th className="px-4 py-3">Çıkış</th>
                  <th className="px-4 py-3">Varış</th>
                  <th className="px-4 py-3 text-center">İhtiyaç</th>
                  <th className="px-4 py-3 text-center">Bildirilen</th>
                  <th className="px-4 py-3 text-center">Onaylanan</th>
                  <th className="px-4 py-3 text-center">Eksik</th>
                  <th className="px-4 py-3 text-center">Karşılama</th>
                  <th className="px-4 py-3 text-right">Risk Seviyesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.map((r) => (
                  <tr key={r.routeKey} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{r.routeKey}</td>
                    <td className="px-4 py-3 text-slate-700">{r.origin}</td>
                    <td className="px-4 py-3 text-[#0D3978] font-bold">{r.destination}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">{r.totalDemand}</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700">{r.totalReported}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-[#239B70]">{r.totalApproved}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-rose-700">{r.totalMissing}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-slate-900">%{r.fulfillmentRate}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-[10px] text-slate-700">{r.riskLevel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black">
                <tr>
                  <th className="px-4 py-3">Tedarikçi</th>
                  <th className="px-4 py-3 text-center">Atanan İhtiyaç</th>
                  <th className="px-4 py-3 text-center">Bildirilen</th>
                  <th className="px-4 py-3 text-center">Onaylanan</th>
                  <th className="px-4 py-3 text-center">Tesise Giriş</th>
                  <th className="px-4 py-3 text-center">Eksik</th>
                  <th className="px-4 py-3 text-center">Karşılama Oranı</th>
                  <th className="px-4 py-3 text-center">Zamanında Teslim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.supplierId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-[#092B60]">{s.companyName}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-slate-800">{s.totalAssigned}</td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700">{s.totalReported}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-[#239B70]">{s.totalApproved}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-emerald-800">{s.totalArrived}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-rose-700">{s.totalMissing}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-slate-900">%{s.fulfillmentRate}</td>
                    <td className="px-4 py-3 text-center font-mono font-black text-emerald-800">%{s.onTimeRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Excel Export Modal */}
      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        requests={requests}
        assignments={assignments}
        vehicles={vehicles}
        suppliers={allSuppliers}
        facilities={facilities}
      />
    </div>
  );
};
