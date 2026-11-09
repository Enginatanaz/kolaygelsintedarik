import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Facility, Supplier, RouteStop } from '../../types';
import { createVehicleRequestWithDistribution } from '../../services/logisticsService';
import {
  PlusCircle,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Trash2,
  MapPin,
  Route,
} from 'lucide-react';

interface CreateRequestModalProps {
  facilities: Facility[];
  suppliers: Supplier[];
  onSuccess: () => void;
}

export const CreateRequestForm: React.FC<CreateRequestModalProps> = ({
  facilities,
  suppliers,
  onSuccess,
}) => {
  const { currentUser, userProfile } = useAuth();

  const activeFacilities = facilities.filter((f) => f.active !== false);
  const defaultOrigin = activeFacilities[0]?.facilityName || 'ANKARA TM';
  const defaultDest = activeFacilities[1]?.facilityName || 'İZMİR TM';

  const [originFacility, setOriginFacility] = useState(defaultOrigin);
  const [destination, setDestination] = useState(defaultDest);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [vehicleType, setVehicleType] = useState('TIR (Tenteli 13.60)');
  const [totalQuantity, setTotalQuantity] = useState<number>(5);
  const [distributionMode, setDistributionMode] = useState<'MANUAL' | 'OPEN'>('MANUAL');
  const [requiredDate, setRequiredDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredTime, setRequiredTime] = useState('08:30');
  const [description, setDescription] = useState('');

  // Manual distribution quota allocation per supplier (dynamically initialized)
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active !== false), [suppliers]);

  const [manualDistribution, setManualDistribution] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    suppliers.filter((s) => s.active !== false).forEach((s, idx) => {
      init[s.id] = idx === 0 ? 2 : 1;
    });
    return init;
  });

  // Open mode selection (dynamically initialized from active suppliers)
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(() => {
    return suppliers.filter((s) => s.active !== false).map((s) => s.id);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Stop Management
  const addStop = () => {
    const nextFacility = activeFacilities.find(
      (f) => f.facilityName !== originFacility && f.facilityName !== destination && !routeStops.some(s => s.facilityName === f.facilityName)
    )?.facilityName || activeFacilities[0]?.facilityName || 'AKSARAY TM';

    const newStop: RouteStop = {
      facilityId: nextFacility.toLowerCase().replace(/\s+/g, '-'),
      facilityName: nextFacility,
      sequence: routeStops.length + 1,
      note: '',
      expectedArrival: '',
    };
    setRouteStops([...routeStops, newStop]);
  };

  const removeStop = (index: number) => {
    const updated = routeStops.filter((_, i) => i !== index);
    // Re-index sequences
    const reindexed = updated.map((s, i) => ({ ...s, sequence: i + 1 }));
    setRouteStops(reindexed);
  };

  const moveStop = (index: number, direction: 'UP' | 'DOWN') => {
    if ((direction === 'UP' && index === 0) || (direction === 'DOWN' && index === routeStops.length - 1)) {
      return;
    }
    const updated = [...routeStops];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Re-index sequences
    const reindexed = updated.map((s, i) => ({ ...s, sequence: i + 1 }));
    setRouteStops(reindexed);
  };

  const updateStopFacility = (index: number, facilityName: string) => {
    const updated = [...routeStops];
    updated[index] = {
      ...updated[index],
      facilityName,
      facilityId: facilityName.toLowerCase().replace(/\s+/g, '-'),
    };
    setRouteStops(updated);
  };

  const updateStopNote = (index: number, note: string) => {
    const updated = [...routeStops];
    updated[index] = { ...updated[index], note };
    setRouteStops(updated);
  };

  // Validation
  const currentManualTotal = Object.values(manualDistribution).reduce((a, b) => a + (b || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    if (userProfile?.role !== 'ADMIN') {
      setError('Araç talebi oluşturmak için Yönetici (Admin) yetkisine sahip olmalısınız.');
      return;
    }

    if (totalQuantity <= 0) {
      setError('Talep edilen araç sayısı en az 1 olmalıdır.');
      return;
    }

    if (originFacility === destination) {
      setError('Çıkış tesisi ile son varış tesisi aynı olamaz.');
      return;
    }

    if (distributionMode === 'MANUAL' && currentManualTotal > totalQuantity) {
      setError(
        `Manuel dağıtım toplamı (${currentManualTotal}) talep edilen toplam miktarı (${totalQuantity}) aşamaz!`
      );
      return;
    }

    if (distributionMode === 'OPEN' && selectedSuppliers.length === 0) {
      setError('Açık talepte en az 1 tedarikçi firma seçilmelidir.');
      return;
    }

    setLoading(true);
    try {
      await createVehicleRequestWithDistribution({
        originFacility,
        routeStops,
        destination,
        vehicleType,
        totalQuantity,
        distributionMode,
        requiredDate,
        requiredTime,
        description,
        manualDistribution: distributionMode === 'MANUAL' ? manualDistribution : undefined,
        selectedSuppliers: distributionMode === 'OPEN' ? selectedSuppliers : undefined,
        createdBy: currentUser.uid,
        userRole: userProfile?.role || 'ADMIN',
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Talep oluşturulurken hata meydana geldi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl border border-slate-200 shadow-md p-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
        <div className="w-10 h-10 rounded-lg bg-[#092B60] text-[#FFD000] flex items-center justify-center font-bold">
          <Route className="w-6 h-6 text-[#FFD000]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#092B60]">Yeni Uğraklı Araç Tedarik Talebi</h2>
          <p className="text-xs text-slate-500">
            Çok duraklı lojistik rotası ve gizlilik ilkesine uygun tedarikçi dağıtım motoru
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-[#A7F36B]/30 border border-emerald-400 text-emerald-950 text-xs flex items-center gap-2 font-bold">
          <Check className="w-4 h-4 shrink-0" />
          <span>Talep başarıyla oluşturuldu ve yetkili tedarikçilere iletildi. Yönlendiriliyorsunuz...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* Güzergâh Önizleme Bandı (Route Visualization Banner) */}
        <div className="p-3 bg-[#EAF3FF] border border-[#0D3978]/20 rounded-xl">
          <span className="text-[11px] font-bold text-[#092B60] uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#092B60]" />
            Güzergâh Akış Önizlemesi
          </span>
          <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-[#092B60]">
            <span className="bg-[#092B60] text-white px-2.5 py-1 rounded-md shadow-2xs">
              {originFacility} (ÇIKIŞ)
            </span>
            {routeStops.map((stop, idx) => (
              <React.Fragment key={idx}>
                <ArrowRight className="w-4 h-4 text-[#0D3978]" />
                <span className="bg-[#FFD000] text-[#092B60] px-2.5 py-1 rounded-md shadow-2xs border border-[#092B60]/20">
                  {stop.sequence}. UĞRAK: {stop.facilityName}
                </span>
              </React.Fragment>
            ))}
            <ArrowRight className="w-4 h-4 text-[#0D3978]" />
            <span className="bg-[#0D3978] text-[#FFD000] px-2.5 py-1 rounded-md shadow-2xs">
              {destination} (VARAN)
            </span>
          </div>
        </div>

        {/* Origin & Destination (Master Dropdowns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-[#092B60] mb-1">
              Çıkış Tesisi (Yükleme Noktası Master Veritabanından)
            </label>
            <select
              value={originFacility}
              onChange={(e) => setOriginFacility(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60] font-semibold text-slate-800"
              required
            >
              {activeFacilities.map((fac) => (
                <option key={fac.id} value={fac.facilityName}>
                  {fac.facilityName} ({fac.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#092B60] mb-1">
              Son Varış Tesisi (Teslimat Noktası)
            </label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60] font-semibold text-slate-800"
              required
            >
              {activeFacilities.map((fac) => (
                <option key={fac.id} value={fac.facilityName}>
                  {fac.facilityName} ({fac.city})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Requirement 3: UĞRAK NOKTALARI MODÜLÜ */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-[#092B60] text-sm block">Uğrak Noktaları (Ara Duraklar)</span>
              <span className="text-[11px] text-slate-500">
                Araçların teslimat öncesinde uğrayacağı ara tesisleri sırasıyla ekleyin
              </span>
            </div>
            <button
              type="button"
              onClick={addStop}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#092B60] text-[#FFD000] hover:bg-[#0D3978] rounded-lg font-bold text-xs shadow-2xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Uğrak Ekle</span>
            </button>
          </div>

          {routeStops.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-xs italic bg-white rounded-lg border border-dashed border-slate-300">
              Henüz uğrak noktası eklenmedi. Doğrudan Çıkış → Varış rotası uygulanır.
            </div>
          ) : (
            <div className="space-y-2">
              {routeStops.map((stop, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs"
                >
                  <span className="w-6 h-6 rounded-full bg-[#092B60] text-[#FFD000] font-black text-xs flex items-center justify-center shrink-0">
                    {stop.sequence}
                  </span>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={stop.facilityName}
                      onChange={(e) => updateStopFacility(idx, e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#092B60]"
                    >
                      {activeFacilities.map((fac) => (
                        <option key={fac.id} value={fac.facilityName}>
                          {fac.facilityName} ({fac.city})
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Uğrak Notu / İndirme Talimatı (Opsiyonel)"
                      value={stop.note || ''}
                      onChange={(e) => updateStopNote(idx, e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
                    />
                  </div>

                  {/* Reorder and Delete controls */}
                  <div className="flex items-center justify-end gap-1 shrink-0 pt-1 sm:pt-0 border-t sm:border-0 border-slate-100">
                    <button
                      type="button"
                      onClick={() => moveStop(idx, 'UP')}
                      disabled={idx === 0}
                      className="p-1.5 text-slate-600 hover:text-[#092B60] hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Yukarı Taşı"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStop(idx, 'DOWN')}
                      disabled={idx === routeStops.length - 1}
                      className="p-1.5 text-slate-600 hover:text-[#092B60] hover:bg-slate-100 rounded disabled:opacity-30"
                      title="Aşağı Taşı"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStop(idx)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                      title="Uğrağı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle Type, Quantity and Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold text-[#092B60] mb-1">Araç Tipi</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60] font-medium"
            >
              <option value="TIR (Tenteli 13.60)">TIR (Tenteli 13.60)</option>
              <option value="TIR (Frigo / Termokin)">TIR (Frigo / Termokin)</option>
              <option value="Kamyon (10 Teker)">Kamyon (10 Teker)</option>
              <option value="Kamyonet (Panelvan / Liftli)">Kamyonet (Panelvan / Liftli)</option>
              <option value="Konteyner Taşıyıcı">Konteyner Taşıyıcı</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#092B60] mb-1">Toplam İhtiyaç (Araç Sayısı)</label>
            <input
              type="number"
              min="1"
              max="200"
              value={totalQuantity}
              onChange={(e) => setTotalQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60] font-black text-slate-900 text-sm"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#092B60] mb-1">Gereken Tarih & Saat</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-2/3 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60]"
                required
              />
              <input
                type="time"
                value={requiredTime}
                onChange={(e) => setRequiredTime(e.target.value)}
                className="w-1/3 px-2 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60]"
              />
            </div>
          </div>
        </div>

        {/* 4 & 6. TALEP DAĞITIM & GİZLİLİK MOTORU */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
          <div>
            <label className="block font-black text-[#092B60] text-sm mb-1">
              Tedarikçi Dağıtım & Gizlilik Motoru
            </label>
            <p className="text-[11px] text-slate-500 mb-3">
              Yalnızca seçilen veya kota atanan tedarikçiler bu talebe erişebilir. Atanmayan firmalar kesinlikle göremez.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDistributionMode('MANUAL')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  distributionMode === 'MANUAL'
                    ? 'border-[#092B60] bg-[#EAF3FF] ring-2 ring-[#092B60]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-[#092B60] flex items-center justify-between">
                  <span>MANUEL DAĞITIM</span>
                  {distributionMode === 'MANUAL' && <span className="w-2.5 h-2.5 rounded-full bg-[#092B60]" />}
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Yönetici doğrudan firma kotalarını belirler. Kota verilen firmalar talebi görür.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDistributionMode('OPEN')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  distributionMode === 'OPEN'
                    ? 'border-[#092B60] bg-[#EAF3FF] ring-2 ring-[#092B60]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-[#092B60] flex items-center justify-between">
                  <span>AÇIK TALEP (SEÇİLİ HAVUZ)</span>
                  {distributionMode === 'OPEN' && <span className="w-2.5 h-2.5 rounded-full bg-[#092B60]" />}
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Seçilen firmalar teklif verir. Yalnızca davet edilen firmaların ekranına düşer.
                </p>
              </button>
            </div>
          </div>

          {/* Distribution Mode Details */}
          {distributionMode === 'MANUAL' ? (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#092B60] text-xs">
                  Firma Bazlı Araç Kota Ataması:
                </span>
                <span className={`text-xs font-bold ${currentManualTotal > totalQuantity ? 'text-rose-600' : 'text-[#092B60]'}`}>
                  Atanan Toplam: {currentManualTotal} / {totalQuantity} Araç
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {suppliers.map((sup) => (
                  <div key={sup.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="font-bold text-slate-800 block truncate">{sup.companyName}</span>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Kota:</span>
                      <input
                        type="number"
                        min="0"
                        max={totalQuantity}
                        value={manualDistribution[sup.id] || 0}
                        onChange={(e) =>
                          setManualDistribution({
                            ...manualDistribution,
                            [sup.id]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded font-black text-center text-xs text-[#092B60]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <span className="font-bold text-[#092B60] text-xs block">
                Talebi Görecek Ve Teklif Verebilecek Tedarikçiler:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {suppliers.map((sup) => {
                  const isChecked = selectedSuppliers.includes(sup.id);
                  return (
                    <label
                      key={sup.id}
                      className={`p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-white border-[#092B60] shadow-2xs font-bold'
                          : 'bg-slate-100 border-slate-200 opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSuppliers([...selectedSuppliers, sup.id]);
                          } else {
                            setSelectedSuppliers(selectedSuppliers.filter((id) => id !== sup.id));
                          }
                        }}
                        className="rounded text-[#092B60] focus:ring-0"
                      />
                      <span className="text-slate-800 truncate text-xs">{sup.companyName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Description / Instructions */}
        <div>
          <label className="block font-bold text-[#092B60] mb-1">Operasyon / Rampa Notu</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Örn: Yükleme rampası 4 numaralı kapıdır. Uğrak noktalarında boşaltma önceliği gözetilmelidir."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60]"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onSuccess}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] rounded-lg font-bold shadow-md transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {loading ? 'Kaydediliyor...' : 'Uğraklı Talebi Yayınla & Tedarikçilere Dağıt'}
          </button>
        </div>
      </form>
    </div>
  );
};
