import React, { useState } from 'react';
import { Vehicle, Supplier, VehicleStatus, VEHICLE_STATUS_LABELS } from '../../types';
import { updateVehicleStatus } from '../../services/logisticsService';
import { useAuth } from '../../context/AuthContext';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  MessageSquare,
  Search,
  Filter,
  Check,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Radio,
  X,
} from 'lucide-react';

interface OperatorDashboardProps {
  vehicles: Vehicle[];
  suppliers: Supplier[];
  currentTab: string;
  onOpenMessageModal: (vehicle: Vehicle) => void;
}

export const OperatorDashboard: React.FC<OperatorDashboardProps> = ({
  vehicles,
  suppliers,
  currentTab,
  onOpenMessageModal,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');

  // Specific status updates quick action modal
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
  const [newStatus, setNewStatus] = useState<VehicleStatus>('YOLDA');
  const [eventDesc, setEventDesc] = useState('');
  const [actualArrival, setActualArrival] = useState('');
  const [updating, setUpdating] = useState(false);

  // Tab-based filtering
  let filtered = vehicles;
  if (currentTab === 'op-on-road') {
    filtered = vehicles.filter((v) => v.status === 'YOLDA' || v.status === 'ON_THE_WAY');
  } else if (currentTab === 'op-arrived') {
    filtered = vehicles.filter((v) => v.status === 'TESISE_GIRIS_YAPTI' || v.status === 'ARRIVED');
  } else if (currentTab === 'op-delayed') {
    filtered = vehicles.filter((v) => v.status === 'GECIKTI');
  } else if (currentTab === 'op-broken') {
    filtered = vehicles.filter((v) => v.status === 'ARIZALI');
  }

  // Search & Supplier filter
  filtered = filtered.filter((v) => {
    const matchesSearch =
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.driverPhone.includes(searchTerm);
    const matchesSup = selectedSupplier === 'ALL' || v.supplierId === selectedSupplier;
    return matchesSearch && matchesSup;
  });

  const handleUpdate = async () => {
    if (!currentUser || !activeVehicle) return;
    setUpdating(true);
    try {
      await updateVehicleStatus(
        activeVehicle.id,
        newStatus,
        currentUser.uid,
        userProfile?.role || 'OPERATOR',
        eventDesc,
        actualArrival || undefined
      );
      setActiveVehicle(null);
      setEventDesc('');
      setActualArrival('');
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  // Quick action: Confirm Arrival at Facility (Araç Girişini Teyit Et)
  const handleQuickConfirmArrival = async (v: Vehicle) => {
    if (!currentUser) return;
    const nowTime = new Date().toTimeString().slice(0, 5);
    try {
      await updateVehicleStatus(
        v.id,
        'TESISE_GIRIS_YAPTI',
        currentUser.uid,
        userProfile?.role || 'OPERATOR',
        `Tesise giriş onaylandı: ${nowTime}`,
        nowTime
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Top Banner & KPI counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-sky-600">
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">YOLDA OLAN ARAÇLAR</div>
          <div className="text-2xl font-mono font-black text-sky-700 tracking-tight">
            {vehicles.filter((v) => v.status === 'YOLDA' || v.status === 'ON_THE_WAY').length}
          </div>
          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Seyir Halindeki Filo</div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#239B70]">
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">TESİSE GİRİŞ YAPANLAR</div>
          <div className="text-2xl font-mono font-black text-[#239B70] tracking-tight">
            {vehicles.filter((v) => v.status === 'TESISE_GIRIS_YAPTI' || v.status === 'ARRIVED').length}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Tesiste Kabul Edilen</div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#FFD000]">
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">GECİKEN ARAÇLAR</div>
          <div className="text-2xl font-mono font-black text-amber-900 tracking-tight">
            {vehicles.filter((v) => v.status === 'GECIKTI').length}
          </div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">Saat Aşımı Yaşayan</div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-rose-500">
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">ARIZALI / PROBLEM</div>
          <div className="text-2xl font-mono font-black text-rose-700 tracking-tight">
            {vehicles.filter((v) => v.status === 'ARIZALI').length}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">Operasyonel Müdahale</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Plaka, şoför veya telefon ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#092B60] text-xs font-bold"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800 text-xs bg-white"
          >
            <option value="ALL">Tüm Tedarikçiler (4 Firma)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.companyName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Operator Vehicles Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex items-center justify-between border-b border-[#0D3978]">
          <h2 className="font-black text-sm flex items-center gap-2 text-white font-sans">
            <Radio className="w-4 h-4 text-[#FFD000]" />
            Tüm Tedarikçi Araçları ve Uğrak Takip Çizelgesi
          </h2>
          <span className="text-xs bg-[#FFD000] text-[#092B60] px-3 py-0.5 rounded-full font-mono font-black shadow-2xs">
            {filtered.length} Araç
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
              <tr>
                <th className="px-4 py-3.5">Plaka & Tip</th>
                <th className="px-4 py-3.5">Firma</th>
                <th className="px-4 py-3.5">Şoför & Tel</th>
                <th className="px-4 py-3.5">Çıkış, Uğraklar & Varış Güzergâhı</th>
                <th className="px-4 py-3.5">Beklenen / Giriş</th>
                <th className="px-4 py-3.5">Durum</th>
                <th className="px-4 py-3.5 text-right">Operatör Hızlı Aksiyonlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => {
                const sup = suppliers.find((s) => s.id === v.supplierId);
                const meta = VEHICLE_STATUS_LABELS[v.status] || {
                  label: v.status,
                  badgeClass: 'bg-slate-100 text-slate-700',
                };
                const stops = v.routeStops || [];

                return (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-black text-[#092B60] text-sm flex items-center gap-1.5 tracking-tight">
                        <Truck className="w-3.5 h-3.5 text-[#092B60]" />
                        {v.plate}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">{v.vehicleType}</div>
                    </td>

                    <td className="px-4 py-3.5 font-bold text-slate-800">
                      {sup?.companyName || v.supplierId}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{v.driverName}</div>
                      <div className="text-slate-500 font-mono text-[11px] mt-0.5">{v.driverPhone}</div>
                    </td>

                    {/* Uğraklı Araç Güzergâh Detayı */}
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900">
                          <span className="text-[#092B60]">{v.originFacility}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-[#0D3978]">{v.destination}</span>
                        </div>
                        {stops.length > 0 && (
                          <div className="flex items-center flex-wrap gap-1 text-[10px]">
                            <span className="text-slate-400 font-medium">Uğraklar:</span>
                            {stops.map((s, idx) => (
                              <span
                                key={idx}
                                className="bg-[#FFD000]/20 text-[#092B60] border border-[#FFD000]/70 px-1.5 py-0.2 rounded-md font-bold font-mono"
                              >
                                {s.sequence}. {s.facilityName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono">
                      <div className="text-slate-800 font-bold">{v.expectedArrival || '09:00'}</div>
                      {v.actualArrival && (
                        <div className="text-emerald-800 font-black text-[11px] bg-[#A7F36B]/30 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-emerald-300">
                          Giriş: {v.actualArrival}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold border ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Confirm Arrival Button */}
                        {v.status !== 'TESISE_GIRIS_YAPTI' && (
                          <button
                            onClick={() => handleQuickConfirmArrival(v)}
                            title="Tesise Girişini Teyit Et"
                            className="bg-[#A7F36B] hover:bg-[#91e252] text-[#092B60] px-3 py-1 rounded-xl font-black text-[11px] flex items-center gap-1 transition-all active:scale-98 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Giriş Teyit</span>
                          </button>
                        )}

                        {/* Status Modal Trigger */}
                        <button
                          onClick={() => {
                            setActiveVehicle(v);
                            setNewStatus(v.status);
                          }}
                          className="bg-[#0D3978] hover:bg-[#092B60] text-white px-3 py-1 rounded-xl font-bold text-[11px] transition-colors"
                        >
                          Durum/Arıza
                        </button>

                        {/* Message Button */}
                        <button
                          onClick={() => onOpenMessageModal(v)}
                          title="Şoföre WhatsApp veya SMS İlet"
                          className="p-1.5 bg-[#EAF3FF] hover:bg-blue-100 text-[#092B60] border border-blue-200 rounded-xl transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    Seçilen filtreye uygun kayıtlı araç bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STATUS / DELAY / PROBLEM MODAL */}
      {activeVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-sm text-[#092B60] mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Operasyonel Durum & Problem Kaydı
            </h3>
            <p className="text-slate-500 mb-4 text-xs">
              {activeVehicle.plate} ({activeVehicle.driverName}) için durum veya gecikme bilgisi kaydedin.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Araç Durumu:</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as VehicleStatus)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 text-xs bg-white"
                >
                  {Object.entries(VEHICLE_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {newStatus === 'TESISE_GIRIS_YAPTI' && (
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Giriş Saati:</label>
                  <input
                    type="time"
                    value={actualArrival}
                    onChange={(e) => setActualArrival(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-[#092B60] mb-1">
                  Açıklama / Olay Detayı (Gecikme nedeni, lastik patlaması, rampa bekleme vb.):
                </label>
                <textarea
                  rows={3}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Durum detayı..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 text-xs">
              <button
                onClick={() => setActiveVehicle(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold"
              >
                Vazgeç
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="px-5 py-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl shadow-md transition-all active:scale-98"
              >
                {updating ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

