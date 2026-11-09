import React, { useState, useEffect, useMemo } from 'react';
import {
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  DailyRequestTemplate,
  DailyRequestDraft,
  Facility,
  Supplier,
  RouteStop,
  TemplateRecurrenceType,
} from '../../types';
import {
  saveDailyRequestTemplate,
  toggleTemplateActive,
  deleteTemplate,
  generateDraftsForDate,
  updateDailyDraft,
  deleteDailyDraft,
  createRequestsFromDrafts,
  distributeDraftsToSuppliers,
} from '../../services/templateService';
import {
  CalendarClock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Route,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Send,
  Check,
  X,
  Layers,
  Calendar,
  Truck,
  ShieldAlert,
  FileCheck2,
  Share2,
} from 'lucide-react';

interface DailyTemplatesViewProps {
  facilities: Facility[];
  suppliers: Supplier[];
  onNavigateToTab?: (tabId: string) => void;
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Pazartesi' },
  { id: 2, label: 'Salı' },
  { id: 3, label: 'Çarşamba' },
  { id: 4, label: 'Perşembe' },
  { id: 5, label: 'Cuma' },
  { id: 6, label: 'Cumartesi' },
  { id: 0, label: 'Pazar' },
];

export const DailyTemplatesView: React.FC<DailyTemplatesViewProps> = ({
  facilities,
  suppliers,
  onNavigateToTab,
}) => {
  const { currentUser, userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN';

  // Navigation tab inside this view
  const [activeSubTab, setActiveSubTab] = useState<'DRAFTS' | 'TEMPLATES'>('DRAFTS');

  // Selected date for drafts (Default: Today in YYYY-MM-DD)
  const todayStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Firestore Data State
  const [templates, setTemplates] = useState<DailyRequestTemplate[]>([]);
  const [drafts, setDrafts] = useState<DailyRequestDraft[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingDrafts, setLoadingDrafts] = useState(true);

  // Selection state for drafts
  const [selectedDraftIds, setSelectedDraftIds] = useState<{ [draftId: string]: boolean }>({});

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DailyRequestTemplate | null>(null);

  // Form fields for Template
  const activeFacilities = useMemo(() => facilities.filter((f) => f.active !== false), [facilities]);
  const defaultOrigin = activeFacilities[0]?.facilityName || 'ANKARA TM';
  const defaultDest = activeFacilities[1]?.facilityName || 'İZMİR TM';

  const [formName, setFormName] = useState('');
  const [formOrigin, setFormOrigin] = useState(defaultOrigin);
  const [formRouteStops, setFormRouteStops] = useState<RouteStop[]>([]);
  const [formDestination, setFormDestination] = useState(defaultDest);
  const [formVehicleType, setFormVehicleType] = useState('TIR (Tenteli 13.60)');
  const [formQuantity, setFormQuantity] = useState(2);
  const [formTime, setFormTime] = useState('09:00');
  const [formRecurrenceType, setFormRecurrenceType] = useState<TemplateRecurrenceType>('WEEKDAYS');
  const [formRecurrenceDays, setFormRecurrenceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formPriority, setFormPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [formDistributionMode, setFormDistributionMode] = useState<'MANUAL' | 'OPEN'>('MANUAL');
  const [formDescription, setFormDescription] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formManualDistribution, setFormManualDistribution] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    suppliers.filter((s) => s.active !== false).forEach((s, idx) => {
      init[s.id] = idx === 0 ? 1 : 0;
    });
    return init;
  });

  // 1. Subscribe to Templates
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      doc(db, 'facilities', 'system_templates_registry'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data().templates)) {
          const list = [...(snap.data().templates as DailyRequestTemplate[])];
          list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setTemplates(list);
        } else {
          setTemplates([]);
        }
        setLoadingTemplates(false);
      },
      (err) => {
        console.error('Templates snapshot error:', err);
        setLoadingTemplates(false);
      }
    );
    return () => unsub();
  }, [isAdmin]);

  // 2. Subscribe to Drafts for selectedDate
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingDrafts(true);
    const unsub = onSnapshot(
      doc(db, 'facilities', 'system_drafts_registry'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data().drafts)) {
          const allDrafts = snap.data().drafts as DailyRequestDraft[];
          const list = allDrafts.filter((d) => d.plannedDate === selectedDate);
          setDrafts(list);
        } else {
          setDrafts([]);
        }
        setLoadingDrafts(false);
      },
      (err) => {
        console.error('Drafts snapshot error:', err);
        setLoadingDrafts(false);
      }
    );
    return () => unsub();
  }, [isAdmin, selectedDate]);

  // Handle open template modal for create/edit
  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormOrigin(defaultOrigin);
    setFormRouteStops([]);
    setFormDestination(defaultDest);
    setFormVehicleType('TIR (Tenteli 13.60)');
    setFormQuantity(2);
    setFormTime('09:00');
    setFormRecurrenceType('WEEKDAYS');
    setFormRecurrenceDays([1, 2, 3, 4, 5]);
    setFormStartDate('');
    setFormEndDate('');
    setFormPriority('NORMAL');
    setFormDistributionMode('MANUAL');
    setFormDescription('');
    setFormActive(true);
    const initDist: Record<string, number> = {};
    suppliers.filter((s) => s.active !== false).forEach((s, idx) => {
      initDist[s.id] = idx === 0 ? 1 : 0;
    });
    setFormManualDistribution(initDist);
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplate = (tpl: DailyRequestTemplate) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormOrigin(tpl.originFacility);
    setFormRouteStops(tpl.routeStops || []);
    setFormDestination(tpl.destination);
    setFormVehicleType(tpl.vehicleType);
    setFormQuantity(tpl.defaultQuantity || 1);
    setFormTime(tpl.requiredTime || '09:00');
    setFormRecurrenceType(tpl.recurrenceType || 'DAILY');
    setFormRecurrenceDays(tpl.recurrenceDays || [1, 2, 3, 4, 5]);
    setFormStartDate(tpl.startDate || '');
    setFormEndDate(tpl.endDate || '');
    setFormPriority(tpl.priority || 'NORMAL');
    setFormDistributionMode(tpl.distributionMode || 'MANUAL');
    setFormDescription(tpl.description || '');
    setFormActive(tpl.active !== false);
    const fallbackDist: Record<string, number> = {};
    suppliers.filter((s) => s.active !== false).forEach((s, idx) => {
      fallbackDist[s.id] = idx === 0 ? 1 : 0;
    });
    setFormManualDistribution(tpl.manualDistribution || fallbackDist);
    setIsTemplateModalOpen(true);
  };

  // Route stop helpers
  const handleAddStop = () => {
    const nextFacility = activeFacilities.find(
      (f) =>
        f.facilityName !== formOrigin &&
        f.facilityName !== formDestination &&
        !formRouteStops.some((s) => s.facilityName === f.facilityName)
    )?.facilityName || activeFacilities[0]?.facilityName || 'AKSARAY TM';

    const newStop: RouteStop = {
      facilityId: nextFacility.toLowerCase().replace(/\s+/g, '-'),
      facilityName: nextFacility,
      sequence: formRouteStops.length + 1,
      note: '',
    };
    setFormRouteStops([...formRouteStops, newStop]);
  };

  const handleRemoveStop = (idx: number) => {
    const updated = formRouteStops.filter((_, i) => i !== idx);
    setFormRouteStops(updated.map((s, i) => ({ ...s, sequence: i + 1 })));
  };

  const handleMoveStop = (idx: number, direction: 'UP' | 'DOWN') => {
    if ((direction === 'UP' && idx === 0) || (direction === 'DOWN' && idx === formRouteStops.length - 1)) return;
    const updated = [...formRouteStops];
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFormRouteStops(updated.map((s, i) => ({ ...s, sequence: i + 1 })));
  };

  // Save template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedback({ type: 'error', message: 'Lütfen şablon adını belirtiniz.' });
      return;
    }
    if (formOrigin === formDestination) {
      setFeedback({ type: 'error', message: 'Çıkış ve varış tesisleri aynı olamaz.' });
      return;
    }

    setActionLoading(true);
    try {
      await saveDailyRequestTemplate({
        id: editingTemplate ? editingTemplate.id : undefined,
        name: formName.trim(),
        originFacility: formOrigin,
        routeStops: formRouteStops,
        destination: formDestination,
        vehicleType: formVehicleType,
        defaultQuantity: formQuantity,
        requiredTime: formTime,
        recurrenceType: formRecurrenceType,
        recurrenceDays: formRecurrenceDays,
        startDate: formStartDate,
        endDate: formEndDate,
        priority: formPriority,
        distributionMode: formDistributionMode,
        manualDistribution: formManualDistribution,
        description: formDescription,
        active: formActive,
      });

      setFeedback({
        type: 'success',
        message: editingTemplate ? 'Şablon başarıyla güncellendi.' : 'Yeni şablon başarıyla kaydedildi.',
      });
      setIsTemplateModalOpen(false);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Şablon kaydedilirken hata oluştu.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Template Active
  const handleToggleTemplateActive = async (tpl: DailyRequestTemplate) => {
    try {
      await toggleTemplateActive(tpl.id, !tpl.active);
      setFeedback({
        type: 'success',
        message: `${tpl.name} ${!tpl.active ? 'aktif edildi' : 'pasife alındı'}.`,
      });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Durum değiştirilemedi.' });
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (tpl: DailyRequestTemplate) => {
    if (!window.confirm(`"${tpl.name}" şablonunu silmek istediğinizden emin misiniz?`)) return;
    try {
      await deleteTemplate(tpl.id);
      setFeedback({ type: 'success', message: 'Şablon silindi.' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Şablon silinemedi.' });
    }
  };

  // Generate drafts for selected date
  const handleGenerateDrafts = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const count = await generateDraftsForDate(selectedDate);
      if (count === 0) {
        setFeedback({
          type: 'success',
          message: `Seçilen tarih (${selectedDate}) için tüm aktif şablonlar zaten hazır veya mükerrer kayıt bulunmuyor.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `${count} adet yeni taslak ${selectedDate} tarihi için başarıyla üretildi.`,
        });
      }
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Taslak üretimi başarısız.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Quick edit draft quantity
  const handleUpdateDraftQuantity = async (draftId: string, newQty: number) => {
    if (newQty < 1) return;
    try {
      await updateDailyDraft({ draftId, quantity: newQty });
    } catch (err: any) {
      console.error('Quantity update failed:', err);
    }
  };

  // Quick edit draft time
  const handleUpdateDraftTime = async (draftId: string, newTime: string) => {
    try {
      await updateDailyDraft({ draftId, requiredTime: newTime });
    } catch (err: any) {
      console.error('Time update failed:', err);
    }
  };

  // Delete draft
  const handleDeleteDraft = async (draftId: string) => {
    try {
      await deleteDailyDraft(draftId);
      setSelectedDraftIds((prev) => {
        const next = { ...prev };
        delete next[draftId];
        return next;
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Taslak silinemedi.' });
    }
  };

  // Toggle draft select
  const toggleSelectDraft = (id: string) => {
    setSelectedDraftIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAllDrafts = () => {
    const allSelected = drafts.length > 0 && drafts.every((d) => selectedDraftIds[d.id]);
    const next: { [id: string]: boolean } = {};
    if (!allSelected) {
      drafts.forEach((d) => {
        next[d.id] = true;
      });
    }
    setSelectedDraftIds(next);
  };

  const selectedCount = Object.values(selectedDraftIds).filter(Boolean).length;

  // STAGE 1: Create Requests from Drafts
  const handleCreateRequests = async () => {
    const targetDraftIds = drafts
      .filter((d) => (selectedCount === 0 || selectedDraftIds[d.id]) && d.status !== 'CREATED')
      .map((d) => d.id);

    if (targetDraftIds.length === 0) {
      setFeedback({ type: 'error', message: 'Talebe dönüştürülecek onay bekleyen taslak bulunamadı.' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const count = await createRequestsFromDrafts(targetDraftIds);
      setFeedback({
        type: 'success',
        message: `${count} adet taslak başarıyla gerçek Araç Talebine dönüştürüldü (vehicleRequests oluşturuldu).`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Talepler oluşturulamadı.' });
    } finally {
      setActionLoading(false);
    }
  };

  // STAGE 2: Distribute Created Requests to Suppliers
  const handleDistributeToSuppliers = async () => {
    const targetDraftIds = drafts
      .filter((d) => (selectedCount === 0 || selectedDraftIds[d.id]) && d.status === 'CREATED' && !(d as any).isDistributed)
      .map((d) => d.id);

    if (targetDraftIds.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Tedarikçilere dağıtılacak oluşturulmuş ve henüz dağıtılmamış talep bulunamadı.',
      });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const count = await distributeDraftsToSuppliers(targetDraftIds);
      setFeedback({
        type: 'success',
        message: `${count} adet talep kotalarıyla birlikte tedarikçilere başarıyla dağıtıldı. Tedarikçi ekranlarında yayında!`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Tedarikçilere dağıtılamadı.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Draft Stats
  const draftStats = useMemo(() => {
    const total = drafts.length;
    const reviewed = drafts.filter((d) => d.status === 'REVIEWED').length;
    const created = drafts.filter((d) => d.status === 'CREATED').length;
    const totalVehicles = drafts.reduce((sum, d) => sum + (d.quantity || 0), 0);
    const distributed = drafts.filter((d) => (d as any).isDistributed).length;
    return { total, reviewed, created, totalVehicles, distributed };
  }, [drafts]);

  // Security Access Guard
  if (!isAdmin) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-12">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-base font-black text-rose-900">Erişim Yetkisi Bulunmuyor</h2>
        <p className="text-xs text-rose-700 mt-1 leading-relaxed">
          Günlük Talep Şablonları ve Taslak Yönetim Modülü yalnızca Sistem Yöneticisi (ADMIN) rolü tarafından görüntülenebilir ve yönetilebilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs font-sans">
      {/* Top Banner Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#092B60] tracking-tight">
              Günlük Talep Şablonları & Taslak Masası
            </h1>
            <span className="bg-[#092B60] text-[#FFD000] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              ADMIN ÖZEL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rutin lojistik hat şablonları, mükerrerlik korumalı otomatik taslak üretimi ve 2 aşamalı talep kesinleştirme
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('DRAFTS')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'DRAFTS'
                ? 'bg-white text-[#092B60] shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Günlük Taslak Masası ({drafts.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('TEMPLATES')}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'TEMPLATES'
                ? 'bg-white text-[#092B60] shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Şablon Kütüphanesi ({templates.length})</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold text-xs">{feedback.message}</span>
        </div>
      )}

      {/* SUB-TAB 1: GÜNLÜK TASLAK MASASI */}
      {activeSubTab === 'DRAFTS' && (
        <div className="space-y-5">
          {/* Controls Bar: Date Selector, Auto-Generate & Two-Stage Buttons */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-[#F4F7FC] px-3 py-2 rounded-xl border border-slate-200">
                <Calendar className="w-4 h-4 text-[#092B60]" />
                <span className="font-bold text-slate-700">Taslak Tarihi:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-[#092B60]"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateDrafts}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98"
                title="Aktif şablonları kontrol ederek seçili güne uyan taslakları oluşturur (mükerrer kayıt engellenir)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                <span>Taslakları Otomatik Getir / Üret</span>
              </button>
            </div>

            {/* Two-Stage Execution Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateRequests}
                disabled={actionLoading || drafts.length === 0}
                className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50"
                title="Taslakları resmi vehicleRequests dokümanlarına dönüştürür"
              >
                <FileCheck2 className="w-4 h-4 text-blue-200" />
                <span>1. Talepleri Oluştur ({selectedCount > 0 ? selectedCount : drafts.filter((d) => d.status !== 'CREATED').length})</span>
              </button>

              <button
                type="button"
                onClick={handleDistributeToSuppliers}
                disabled={actionLoading || draftStats.created === 0}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50"
                title="Oluşturulmuş talepleri tedarikçilere dağıtır ve görünür kılar"
              >
                <Share2 className="w-4 h-4 text-emerald-200" />
                <span>2. Tedarikçilere Dağıt</span>
              </button>
            </div>
          </div>

          {/* 4 Mini KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#092B60]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">GÜNLÜK TASLAK</span>
              <span className="text-2xl font-black text-[#092B60] block mt-1">{draftStats.total}</span>
              <span className="text-[10px] text-slate-400 font-medium">Toplam hat taslağı</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#0D3978]">
              <span className="text-[10px] font-bold text-[#0D3978] uppercase tracking-wider block">ARAÇ İHTİYACI</span>
              <span className="text-2xl font-black text-[#0D3978] block mt-1">{draftStats.totalVehicles}</span>
              <span className="text-[10px] text-slate-400 font-medium">Planlanan araç adedi</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-blue-600">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">TALEBE DÖNÜŞEN</span>
              <span className="text-2xl font-black text-blue-700 block mt-1">{draftStats.created}</span>
              <span className="text-[10px] text-slate-400 font-medium">Oluşturulan talep</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-emerald-600">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">DAĞITILAN TALEP</span>
              <span className="text-2xl font-black text-emerald-700 block mt-1">{draftStats.distributed}</span>
              <span className="text-[10px] text-slate-400 font-medium">Tedarikçide yayında</span>
            </div>
          </div>

          {/* Drafts Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="bg-[#092B60] text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#A7F36B]" />
                <h3 className="font-bold text-sm">
                  {selectedDate} Tarihli Talep Taslakları Listesi
                </h3>
              </div>
              <span className="text-xs text-blue-200 font-medium">
                {drafts.length} taslak hazır
              </span>
            </div>

            {loadingDrafts ? (
              <div className="p-12 text-center text-slate-400">
                <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block mr-2"></span>
                Taslaklar yükleniyor...
              </div>
            ) : drafts.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <CalendarClock className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  {selectedDate} tarihi için henüz oluşturulmuş bir taslak bulunmuyor.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Yukarıdaki <strong>"Taslakları Otomatik Getir / Üret"</strong> butonuna tıklayarak haftalık periyodu uyan aktif şablonlardan taslakları otomatik üretebilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateDrafts}
                  className="bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black px-4 py-2 rounded-xl text-xs transition-colors"
                >
                  Taslakları Şimdi Üret
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={drafts.length > 0 && drafts.every((d) => selectedDraftIds[d.id])}
                          onChange={toggleSelectAllDrafts}
                          className="rounded text-[#092B60] focus:ring-[#092B60]"
                        />
                      </th>
                      <th className="p-3">ŞABLON ADI & GÜZERGAH</th>
                      <th className="p-3">ARAÇ TİPİ</th>
                      <th className="p-3 text-center">ADET</th>
                      <th className="p-3 text-center">SAAT</th>
                      <th className="p-3">DAĞITIM KOTASI</th>
                      <th className="p-3 text-center">DURUM</th>
                      <th className="p-3 text-right">İŞLEMLER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {drafts.map((d) => {
                      const isSelected = Boolean(selectedDraftIds[d.id]);
                      const hasStops = (d.routeStops || []).length > 0;
                      const isDistributed = (d as any).isDistributed;

                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectDraft(d.id)}
                              className="rounded text-[#092B60] focus:ring-[#092B60]"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-[#092B60]">{d.templateName}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium mt-0.5">
                              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{d.originFacility}</span>
                              {hasStops && (
                                <>
                                  <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                  <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[10px]">
                                    {d.routeStops?.map((s) => s.facilityName).join(' ➔ ')}
                                  </span>
                                </>
                              )}
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                              <MapPin className="w-3 h-3 text-rose-600 shrink-0" />
                              <span className="font-bold text-slate-800">{d.destination}</span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-700 font-medium">{d.vehicleType}</td>
                          <td className="p-3 text-center">
                            {d.status === 'CREATED' ? (
                              <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                                {d.quantity}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={d.quantity}
                                onChange={(e) => handleUpdateDraftQuantity(d.id, parseInt(e.target.value) || 1)}
                                className="w-14 text-center font-mono font-black text-[#092B60] bg-slate-50 border border-slate-300 rounded-lg py-1 px-1 text-xs focus:ring-1 focus:ring-[#092B60]"
                              />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {d.status === 'CREATED' ? (
                              <span className="font-mono text-slate-700">{d.requiredTime || '09:00'}</span>
                            ) : (
                              <input
                                type="time"
                                value={d.requiredTime || '09:00'}
                                onChange={(e) => handleUpdateDraftTime(d.id, e.target.value)}
                                className="font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-lg py-1 px-1.5"
                              />
                            )}
                          </td>
                          <td className="p-3">
                            {d.distributionMode === 'MANUAL' && d.manualDistribution ? (
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(d.manualDistribution).map(([sId, qty]) => {
                                  if (Number(qty) <= 0) return null;
                                  const sName = suppliers.find((s) => s.id === sId)?.companyName || sId;
                                  return (
                                    <span
                                      key={sId}
                                      className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200"
                                    >
                                      {sName.split(' ')[0]}: <strong>{qty}</strong>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold">
                                Açık Talep
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {d.status === 'CREATED' ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black">
                                  TALEBE DÖNÜŞTÜ
                                </span>
                                {d.createdRequestNumber && (
                                  <span className="font-mono text-[10px] text-slate-500 font-bold mt-0.5">
                                    {d.createdRequestNumber}
                                  </span>
                                )}
                                {isDistributed && (
                                  <span className="text-[9px] text-emerald-700 font-bold mt-0.5">
                                    ✓ Tedarikçide Yayında
                                  </span>
                                )}
                              </div>
                            ) : d.status === 'REVIEWED' ? (
                              <span className="bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                İNCELENDİ
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                TASLAK (BEKLİYOR)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {d.status !== 'CREATED' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDraft(d.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Bu günlük taslağı kaldır"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ŞABLON KÜTÜPHANESİ */}
      {activeSubTab === 'TEMPLATES' && (
        <div className="space-y-5">
          {/* Action Header */}
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div>
              <h3 className="text-base font-bold text-[#092B60]">Periyodik Rota & Talep Şablonları</h3>
              <p className="text-xs text-slate-500">
                Haftalık düzenli seferlerin şablonlarını yönetin. Belirlenen periyotlarda taslaklar otomatik oluşturulur.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreateTemplate}
              className="inline-flex items-center gap-1.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-98"
            >
              <Plus className="w-4 h-4 text-[#FFD000]" />
              <span>Yeni Şablon Oluştur</span>
            </button>
          </div>

          {/* Templates Grid / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => {
              const hasStops = (tpl.routeStops || []).length > 0;
              const recurrenceLabel =
                tpl.recurrenceType === 'DAILY'
                  ? 'Her Gün'
                  : tpl.recurrenceType === 'WEEKDAYS'
                  ? 'Hafta İçi (Pzt-Cum)'
                  : tpl.recurrenceType === 'WEEKENDS'
                  ? 'Hafta Sonu'
                  : 'Özel Günler';

              return (
                <div
                  key={tpl.id}
                  className={`bg-white rounded-2xl border p-4.5 shadow-2xs flex flex-col justify-between transition-all ${
                    tpl.active !== false
                      ? 'border-slate-200/80 hover:border-[#092B60]'
                      : 'border-slate-200 opacity-60 bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-[#092B60]">{tpl.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTemplateActive(tpl)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                          tpl.active !== false
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-200 text-slate-600 border border-slate-300'
                        }`}
                      >
                        {tpl.active !== false ? 'AKTİF' : 'PASİF'}
                      </button>
                    </div>

                    {/* Route line */}
                    <div className="bg-[#F4F7FC] p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{tpl.originFacility}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{tpl.destination}</span>
                      </div>
                      {hasStops && (
                        <div className="text-[10px] text-amber-800 font-semibold flex items-center gap-1 pl-5">
                          <Route className="w-3 h-3 text-amber-600" />
                          <span>Uğraklar: {tpl.routeStops?.map((s) => s.facilityName).join(' ➔ ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Araç & Miktar</span>
                        <span className="font-bold text-slate-800">
                          {tpl.defaultQuantity} x {tpl.vehicleType.split(' ')[0]}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Planlanan Saat</span>
                        <span className="font-mono font-bold text-slate-800">{tpl.requiredTime || '09:00'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Periyot</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[10px]">
                          {recurrenceLabel}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Dağıtım</span>
                        <span className="font-semibold text-slate-700">
                          {tpl.distributionMode === 'MANUAL' ? 'Manuel Kota' : 'Açık Talep'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => handleOpenEditTemplate(tpl)}
                      className="p-1.5 text-slate-600 hover:text-[#092B60] hover:bg-slate-100 rounded-lg transition-colors"
                      title="Şablonu Düzenle"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Şablonu Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#092B60] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CalendarClock className="w-5 h-5 text-[#A7F36B]" />
                <h3 className="text-base font-bold">
                  {editingTemplate ? 'Şablonu Düzenle' : 'Yeni Rutin Talep Şablonu Tanımla'}
                </h3>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 overflow-y-auto space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Şablon Adı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Günlük Ankara - İzmir TIR Ring Seferi"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium focus:ring-2 focus:ring-[#092B60]"
                />
              </div>

              {/* Origin & Destination Facilities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Çıkış Tesisi *
                  </label>
                  <select
                    value={formOrigin}
                    onChange={(e) => setFormOrigin(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
                  >
                    {activeFacilities.map((f) => (
                      <option key={`tpl-orig-${f.id}`} value={f.facilityName}>
                        {f.facilityName} ({f.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Varış Tesisi *
                  </label>
                  <select
                    value={formDestination}
                    onChange={(e) => setFormDestination(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
                  >
                    {activeFacilities.map((f) => (
                      <option key={`tpl-dest-${f.id}`} value={f.facilityName}>
                        {f.facilityName} ({f.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Route Stops (Uğraklar) */}
              <div className="bg-[#F4F7FC] p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#092B60] uppercase tracking-wider flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5 text-[#0D3978]" />
                    Ara Uğrak Noktaları (Opsiyonel)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" />
                    Uğrak Ekle
                  </button>
                </div>

                {formRouteStops.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Doğrudan nokta-nokta sefer (ara uğrak yok).</p>
                ) : (
                  <div className="space-y-1.5">
                    {formRouteStops.map((stop, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#092B60] text-white flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <select
                          value={stop.facilityName}
                          onChange={(e) => {
                            const updated = [...formRouteStops];
                            updated[idx].facilityName = e.target.value;
                            setFormRouteStops(updated);
                          }}
                          className="text-xs p-1 rounded border border-slate-300 flex-1 font-medium"
                        >
                          {activeFacilities.map((f) => (
                            <option key={`stop-${f.id}`} value={f.facilityName}>
                              {f.facilityName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleMoveStop(idx, 'UP')}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStop(idx, 'DOWN')}
                          disabled={idx === formRouteStops.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStop(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vehicle Type, Default Quantity & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Araç Tipi
                  </label>
                  <select
                    value={formVehicleType}
                    onChange={(e) => setFormVehicleType(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
                  >
                    <option value="TIR (Tenteli 13.60)">TIR (Tenteli 13.60)</option>
                    <option value="TIR (Kapalı Kasa)">TIR (Kapalı Kasa)</option>
                    <option value="Kamyon (10 Teker)">Kamyon (10 Teker)</option>
                    <option value="Kamyon (Kırkayak)">Kamyon (Kırkayak)</option>
                    <option value="Kamyonet (Panelvan)">Kamyonet (Panelvan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Günlük Adet
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Planlanan Saat
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Recurrence Rules (Tekrarlama) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-[#0D3978]" />
                  Tekrarlama & Periyot Kuralı
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'DAILY', label: 'Her Gün' },
                    { id: 'WEEKDAYS', label: 'Hafta İçi (Pzt-Cum)' },
                    { id: 'WEEKENDS', label: 'Hafta Sonu' },
                    { id: 'CUSTOM_DAYS', label: 'Özel Günler' },
                  ].map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setFormRecurrenceType(rec.id as any)}
                      className={`p-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                        formRecurrenceType === rec.id
                          ? 'bg-[#092B60] text-white border-[#092B60]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rec.label}
                    </button>
                  ))}
                </div>

                {formRecurrenceType === 'CUSTOM_DAYS' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                    {DAYS_OF_WEEK.map((d) => {
                      const isChecked = formRecurrenceDays.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${
                            isChecked
                              ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setFormRecurrenceDays(formRecurrenceDays.filter((id) => id !== d.id));
                              } else {
                                setFormRecurrenceDays([...formRecurrenceDays, d.id]);
                              }
                            }}
                            className="rounded text-[#092B60]"
                          />
                          <span>{d.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Distribution Mode & Supplier Quotas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tedarikçi Dağıtım Yöntemi
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                    <input
                      type="radio"
                      name="distMode"
                      value="MANUAL"
                      checked={formDistributionMode === 'MANUAL'}
                      onChange={() => setFormDistributionMode('MANUAL')}
                      className="text-[#092B60]"
                    />
                    <span>Manuel Kota Dağıtımı</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                    <input
                      type="radio"
                      name="distMode"
                      value="OPEN"
                      checked={formDistributionMode === 'OPEN'}
                      onChange={() => setFormDistributionMode('OPEN')}
                      className="text-[#092B60]"
                    />
                    <span>Açık Talep (Tüm Tedarikçilere)</span>
                  </label>
                </div>

                {formDistributionMode === 'MANUAL' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {suppliers.filter((s) => s.active !== false).map((sup) => {
                      const sId = sup.id;
                      const sName = sup.companyName;
                      return (
                        <div key={sId} className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="block text-[11px] font-bold text-slate-700 truncate">{sName}</span>
                          <input
                            type="number"
                            min={0}
                            value={formManualDistribution[sId] ?? 0}
                            onChange={(e) =>
                              setFormManualDistribution({
                                ...formManualDistribution,
                                [sId]: Math.max(0, parseInt(e.target.value) || 0),
                              })
                            }
                            className="w-full mt-1 text-center font-mono font-bold text-xs p-1 rounded border border-slate-300"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Switch */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="formActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded text-[#092B60] w-4 h-4"
                />
                <label htmlFor="formActive" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Şablon Aktif (Otomatik taslak üretiminde değerlendirilir)
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-98"
                >
                  {actionLoading ? 'Kaydediliyor...' : editingTemplate ? 'Şablonu Güncelle' : 'Şablonu Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
