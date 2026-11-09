import React, { useState } from 'react';
import { Facility } from '../../types';
import { addFacility, toggleFacilityActive } from '../../services/logisticsService';
import { MapPin, Plus, Power, Search, Building2, CheckCircle2, XCircle } from 'lucide-react';

interface FacilityManagementViewProps {
  facilities: Facility[];
}

export const FacilityManagementView: React.FC<FacilityManagementViewProps> = ({ facilities }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // New facility form state
  const [newFacName, setNewFacName] = useState('');
  const [newFacCity, setNewFacCity] = useState('');
  const [facLoading, setFacLoading] = useState(false);
  const [facError, setFacError] = useState<string | null>(null);
  const [facSuccess, setFacSuccess] = useState<string | null>(null);

  const cities = Array.from(new Set(facilities.map((f) => f.city).filter(Boolean))).sort();

  const filteredFacilities = facilities.filter((fac) => {
    const matchesSearch =
      (fac.facilityName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fac.city || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = cityFilter === 'ALL' || fac.city === cityFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && fac.active !== false) ||
      (statusFilter === 'INACTIVE' && fac.active === false);
    return matchesSearch && matchesCity && matchesStatus;
  });

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacName.trim()) return;
    setFacError(null);
    setFacSuccess(null);
    setFacLoading(true);
    try {
      await addFacility(newFacName, newFacCity);
      setFacSuccess(`Tesis "${newFacName.trim().toUpperCase()}" başarıyla master veritabanına eklendi.`);
      setNewFacName('');
      setNewFacCity('');
      setTimeout(() => setFacSuccess(null), 3500);
    } catch (err: any) {
      setFacError(err.message || 'Tesis eklenemedi.');
    } finally {
      setFacLoading(false);
    }
  };

  const handleToggleFacility = async (facId: string, currentActive: boolean) => {
    try {
      await toggleFacilityActive(facId, !currentActive);
    } catch (err: any) {
      console.error(err);
    }
  };

  const activeCount = facilities.filter((f) => f.active !== false).length;
  const inactiveCount = facilities.filter((f) => f.active === false).length;

  return (
    <div className="space-y-5 text-xs font-sans">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#092B60] tracking-tight">Tesis Master Veritabanı Yönetimi</h1>
            <span className="bg-[#FFD000] text-[#092B60] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              {facilities.length} Tesis Kayıtlı
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Lojistik çıkış noktaları, ara uğrak transfer merkezleri (TM) ve varış tesislerinin merkezi yönetimi
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-emerald-800 font-bold block">Aktif Tesis</span>
            <span className="font-mono font-black text-sm text-[#239B70]">{activeCount}</span>
          </div>
          <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-[10px] text-slate-500 font-bold block">Pasif Tesis</span>
            <span className="font-mono font-black text-sm text-slate-600">{inactiveCount}</span>
          </div>
        </div>
      </div>

      {/* Add Facility Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
        <h2 className="text-sm font-black text-[#092B60] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#FFD000]" />
          <span>Yeni Tesis / Transfer Merkezi Ekle</span>
        </h2>

        <form onSubmit={handleAddFacility} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <input
              type="text"
              placeholder="Yeni Tesis Adı (Örn: SAMSUN TM, DİYARBAKIR AKTARMA MERKEZİ)..."
              value={newFacName}
              onChange={(e) => setNewFacName(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#092B60]"
              required
            />
          </div>
          <div className="w-full sm:w-48">
            <input
              type="text"
              placeholder="Şehir (Örn: Samsun)..."
              value={newFacCity}
              onChange={(e) => setNewFacCity(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#092B60]"
            />
          </div>
          <button
            type="submit"
            disabled={facLoading}
            className="w-full sm:w-auto bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-98 shrink-0 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{facLoading ? 'Ekleniyor...' : 'Tesisi Sisteme Kaydet'}</span>
          </button>
        </form>

        {facSuccess && (
          <div className="mt-3 p-3 bg-emerald-50 text-emerald-950 font-bold border border-emerald-300 rounded-xl">
            {facSuccess}
          </div>
        )}
        {facError && (
          <div className="mt-3 p-3 bg-rose-50 text-rose-800 font-bold border border-rose-200 rounded-xl">
            {facError}
          </div>
        )}
      </div>

      {/* Facilities List & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Tesis adı veya şehir ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#092B60]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none"
            >
              <option value="ALL">Tüm Şehirler</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="ACTIVE">Yalnızca Aktif</option>
              <option value="INACTIVE">Yalnızca Pasif</option>
            </select>
          </div>
        </div>

        {/* Facilities Grid */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto">
          {filteredFacilities.map((fac) => (
            <div
              key={fac.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                fac.active !== false
                  ? 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="truncate pr-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <MapPin className={`w-3.5 h-3.5 shrink-0 ${fac.active !== false ? 'text-[#092B60]' : 'text-slate-400'}`} />
                  <span className="truncate">{fac.facilityName}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1 pl-5">
                  <span>{fac.city || 'Şehir Belirtilmedi'}</span>
                  <span>•</span>
                  <span className={fac.active !== false ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    {fac.active !== false ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleToggleFacility(fac.id, fac.active !== false)}
                title={fac.active !== false ? 'Tesisi Pasife Al' : 'Tesisi Aktifleştir'}
                className={`p-2 rounded-xl transition-colors ${
                  fac.active !== false
                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    : 'text-slate-400 bg-slate-200 hover:bg-slate-300'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {filteredFacilities.length === 0 && (
            <div className="col-span-full p-8 text-center text-slate-400 font-medium">
              Arama kriterlerine uygun tesis bulunamadı.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
