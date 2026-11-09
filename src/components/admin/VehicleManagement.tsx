import React, { useState } from 'react';
import { Vehicle, Supplier, VehicleStatus, VEHICLE_STATUS_LABELS } from '../../types';
import { updateVehicleStatus, transferVehicleSupplier } from '../../services/logisticsService';
import { useAuth } from '../../context/AuthContext';
import {
  Truck,
  ArrowRightLeft,
  MessageSquare,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Phone,
  User,
  MapPin,
  X,
  AlertTriangle,
  ArrowRight,
  Check,
} from 'lucide-react';

interface VehicleManagementProps {
  vehicles: Vehicle[];
  suppliers: Supplier[];
  onOpenMessageModal: (vehicle: Vehicle) => void;
}

export const VehicleManagement: React.FC<VehicleManagementProps> = ({
  vehicles,
  suppliers,
  onOpenMessageModal,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Transfer Modal State
  const [transferVehicle, setTransferVehicle] = useState<Vehicle | null>(null);
  const [targetSupplierId, setTargetSupplierId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Status Change Modal State
  const [statusModalVehicle, setStatusModalVehicle] = useState<Vehicle | null>(null);
  const [newStatus, setNewStatus] = useState<VehicleStatus>('YOLDA');
  const [eventDesc, setEventDesc] = useState('');
  const [actualArrival, setActualArrival] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.driverPhone.includes(searchTerm);
    const matchesSupplier = supplierFilter === 'ALL' || v.supplierId === supplierFilter;
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesSupplier && matchesStatus;
  });

  const handleTransfer = async () => {
    if (!currentUser || !transferVehicle || !targetSupplierId) return;
    setTransferLoading(true);
    try {
      await transferVehicleSupplier(
        transferVehicle.id,
        transferVehicle.supplierId,
        targetSupplierId,
        currentUser.uid
      );
      setTransferVehicle(null);
    } catch (err) {
      console.error(err);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!currentUser || !statusModalVehicle) return;
    setStatusLoading(true);
    try {
      await updateVehicleStatus(
        statusModalVehicle.id,
        newStatus,
        currentUser.uid,
        userProfile?.role || 'OPERATOR',
        eventDesc,
        actualArrival || undefined
      );
      setStatusModalVehicle(null);
      setEventDesc('');
      setActualArrival('');
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(false);
    }
  };

  // NUMERICAL CALCULATION ENGINE
  const reportedCount = vehicles.filter((v) =>
    ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'APPROVED', 'ON_THE_WAY', 'ARRIVED', 'ARAC_BILDIRILDI', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;

  const approvedCount = vehicles.filter((v) =>
    ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;

  const arrivedCount = vehicles.filter((v) =>
    ['ARRIVED', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;

  const pendingApprovalCount = vehicles.filter((v) =>
    ['SUPPLIER_REPORTED', 'REVISION_PENDING', 'ARAC_BILDIRILDI'].includes(v.status)
  ).length;

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* 3 Separate Vehicle Counters Engine Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#092B60]">
          <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">1. BİLDİRİLEN ARAÇ</div>
          <div className="text-2xl font-mono font-black text-[#092B60] tracking-tight">{reportedCount}</div>
          <div className="text-[10px] text-slate-400 font-medium">Tedarikçiler Tarafından Girildi</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-amber-500">
          <div className="text-amber-900 text-[10px] font-bold uppercase tracking-wider">KONTROL BEKLEYEN</div>
          <div className="text-2xl font-mono font-black text-amber-800 tracking-tight">{pendingApprovalCount}</div>
          <div className="text-[10px] text-amber-700 font-medium">Onay / Ret Bekliyor</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#239B70]">
          <div className="text-emerald-900 text-[10px] font-bold uppercase tracking-wider">2. ONAYLANAN ARAÇ</div>
          <div className="text-2xl font-mono font-black text-[#239B70] tracking-tight">{approvedCount}</div>
          <div className="text-[10px] text-emerald-700 font-medium">Yönetici Tarafından Onaylı</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-emerald-600">
          <div className="text-emerald-950 text-[10px] font-bold uppercase tracking-wider">3. SAHAYA VARAN ARAÇ</div>
          <div className="text-2xl font-mono font-black text-emerald-800 tracking-tight">{arrivedCount}</div>
          <div className="text-[10px] text-emerald-700 font-medium">Tesise Giriş Yaptı</div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Plaka, şoför adı veya telefon ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#092B60] text-xs font-bold"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800 text-xs bg-white"
          >
            <option value="ALL">Tüm Tedarikçiler (4 Firma)</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.companyName}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800 text-xs bg-white"
          >
            <option value="ALL">Tüm Durumlar</option>
            {Object.entries(VEHICLE_STATUS_LABELS).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex items-center justify-between border-b border-[#0D3978]">
          <h2 className="font-black text-sm text-white flex items-center gap-2 font-sans">
            <Truck className="w-4 h-4 text-[#FFD000]" />
            Tedarik Edilen Tüm Araçlar & Güzergâh Detayları
          </h2>
          <span className="text-xs bg-[#FFD000] text-[#092B60] px-3 py-0.5 rounded-full font-mono font-black shadow-2xs">
            {filteredVehicles.length} Araç
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
              <tr>
                <th className="px-4 py-3.5">Plaka & Araç</th>
                <th className="px-4 py-3.5">Tedarikçi</th>
                <th className="px-4 py-3.5">Şoför & İletişim</th>
                <th className="px-4 py-3.5">Güzergâh & Uğraklar</th>
                <th className="px-4 py-3.5">Giriş Saati</th>
                <th className="px-4 py-3.5">Mevcut Durum</th>
                <th className="px-4 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.map((vehicle) => {
                const sup = suppliers.find((s) => s.id === vehicle.supplierId);
                const statusMeta = VEHICLE_STATUS_LABELS[vehicle.status] || {
                  label: vehicle.status,
                  badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
                };
                const stops = vehicle.routeStops || [];

                return (
                  <tr key={vehicle.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Plate */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-black text-[#092B60] text-sm flex items-center gap-1.5 tracking-tight">
                        <Truck className="w-3.5 h-3.5 text-[#092B60]" />
                        <span>{vehicle.plate}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">{vehicle.vehicleType}</div>
                    </td>

                    {/* Supplier */}
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-800">
                        {sup?.companyName || vehicle.supplierId}
                      </span>
                    </td>

                    {/* Driver */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{vehicle.driverName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{vehicle.driverPhone}</span>
                      </div>
                    </td>

                    {/* Route */}
                    <td className="px-4 py-3.5 max-w-[260px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1 text-xs">
                          <span>{vehicle.originFacility}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="text-[#0D3978]">{vehicle.destination}</span>
                        </div>
                        {stops.length > 0 && (
                          <div className="text-[10px] text-[#092B60] font-bold">
                            +{stops.length} Uğrak ({stops.map((s) => s.facilityName).join(', ')})
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Arrival time */}
                    <td className="px-4 py-3.5 text-slate-700 font-medium font-mono">
                      <div>Plan: {vehicle.expectedArrival || '09:00'}</div>
                      {vehicle.actualArrival ? (
                        <div className="text-emerald-800 font-black text-[11px] bg-[#A7F36B]/30 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-emerald-300">
                          Giriş: {vehicle.actualArrival}
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px]">Henüz girmedi</div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold border ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick One-Click Approve / Reject for Reported & Revision Vehicles */}
                        {(vehicle.status === 'SUPPLIER_REPORTED' || vehicle.status === 'REVISION_PENDING' || vehicle.status === 'ARAC_BILDIRILDI') && (
                          <>
                            <button
                              onClick={async () => {
                                if (!currentUser) return;
                                try {
                                  await updateVehicleStatus(
                                    vehicle.id,
                                    'APPROVED',
                                    currentUser.uid,
                                    userProfile?.role || 'ADMIN',
                                    'Yönetici tarafından araç onaylandı.'
                                  );
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              title="Aracı Onayla"
                              className="px-2.5 py-1 text-[10px] font-black bg-[#A7F36B] hover:bg-emerald-400 text-[#092B60] rounded-lg shadow-2xs transition-all active:scale-98"
                            >
                              Onayla
                            </button>
                            <button
                              onClick={async () => {
                                if (!currentUser) return;
                                try {
                                  await updateVehicleStatus(
                                    vehicle.id,
                                    'REJECTED',
                                    currentUser.uid,
                                    userProfile?.role || 'ADMIN',
                                    'Yönetici tarafından araç reddedildi.'
                                  );
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              title="Aracı Reddet"
                              className="px-2.5 py-1 text-[10px] font-black bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg border border-rose-300 transition-all active:scale-98"
                            >
                              Reddet
                            </button>
                          </>
                        )}

                        {/* Status Update Button */}
                        <button
                          onClick={() => {
                            setStatusModalVehicle(vehicle);
                            setNewStatus(vehicle.status);
                          }}
                          title="Durum Güncelle"
                          className="px-2.5 py-1 text-[11px] font-bold bg-[#0D3978] hover:bg-[#092B60] text-white rounded-lg transition-colors"
                        >
                          Durum
                        </button>

                        {/* WhatsApp / SMS Message */}
                        <button
                          onClick={() => onOpenMessageModal(vehicle)}
                          title="Şoföre WhatsApp veya SMS Gönder"
                          className="p-1.5 bg-[#EAF3FF] hover:bg-blue-100 text-[#092B60] border border-blue-200 rounded-lg transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        {/* Admin Transfer Vehicle */}
                        {userProfile?.role === 'ADMIN' && (
                          <button
                            onClick={() => {
                              setTransferVehicle(vehicle);
                              setTargetSupplierId(suppliers.find((s) => s.id !== vehicle.supplierId)?.id || '');
                            }}
                            title="Aracı Başka Tedarikçiye Aktar (Admin)"
                            className="p-1.5 bg-[#FFD000]/20 hover:bg-[#FFD000]/40 text-[#092B60] border border-[#FFD000] rounded-lg transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    Kriterlere uygun araç bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TRANSFER VEHICLE TO ANOTHER SUPPLIER */}
      {transferVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-xs border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#092B60] flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-[#092B60]" />
                Aracı Başka Tedarikçiye Aktar
              </h3>
              <button
                onClick={() => setTransferVehicle(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-[#EAF3FF] rounded-xl border border-blue-200">
                <div className="font-mono font-black text-sm text-[#092B60]">{transferVehicle.plate}</div>
                <div className="text-slate-600 font-medium mt-1">
                  Mevcut Tedarikçi:{' '}
                  <strong className="text-slate-900">{suppliers.find((s) => s.id === transferVehicle.supplierId)?.companyName}</strong>
                </div>
                <div className="text-slate-600">Şoför: {transferVehicle.driverName}</div>
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Yeni Tedarikçi Firma Seçin:</label>
                <select
                  value={targetSupplierId}
                  onChange={(e) => setTargetSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 text-xs bg-white"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === transferVehicle.supplierId}>
                      {s.companyName} {s.id === transferVehicle.supplierId ? '(Mevcut)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-slate-500">
                * Bu işlem araç sahipliğini değiştirir ve Audit Log tablosuna kaydedilir.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setTransferVehicle(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold"
              >
                Vazgeç
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferLoading}
                className="px-5 py-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl shadow-md transition-all active:scale-98"
              >
                {transferLoading ? 'Aktarılıyor...' : 'Aktarımı Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPDATE VEHICLE OPERATIONAL STATUS */}
      {statusModalVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-xs border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-[#092B60] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#092B60]" />
                Araç Operasyon Durumu Güncelle
              </h3>
              <button
                onClick={() => setStatusModalVehicle(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between font-bold border border-slate-200">
                <div>
                  <span className="text-[#092B60] font-mono font-black text-sm">{statusModalVehicle.plate}</span>
                  <span className="text-slate-600 text-xs ml-2 font-medium">({statusModalVehicle.driverName})</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {statusModalVehicle.originFacility}
                </span>
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Yeni Durum:</label>
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
                  <label className="block font-bold text-[#092B60] mb-1">
                    Gerçek Giriş Saati (HH:mm):
                  </label>
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
                  Olay / Durum Açıklaması:
                </label>
                <textarea
                  rows={2}
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Durum detayı..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setStatusModalVehicle(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold"
              >
                Kapat
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={statusLoading}
                className="px-5 py-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl shadow-md transition-all active:scale-98"
              >
                {statusLoading ? 'Kaydediliyor...' : 'Durumu Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

