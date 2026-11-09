import React, { useState, useMemo, useEffect } from 'react';
import {
  Supplier,
  VehicleRequest,
  RequestAssignment,
  Vehicle,
  SupplierNotificationSettings,
  NotificationEventPreferences,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  createSupplier,
  updateSupplier,
  resetSupplierPassword,
  toggleSupplierActive,
  deleteOrArchiveSupplier,
} from '../../services/supplierService';
import {
  updateSupplierNotificationSettings,
  verifySupplierEmail,
} from '../../services/notificationService';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  User,
  Power,
  Archive,
  AlertTriangle,
  X,
  Lock,
  Eye,
  EyeOff,
  Bell,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

interface SupplierManagementViewProps {
  suppliers: Supplier[];
  requests?: VehicleRequest[];
  assignments?: RequestAssignment[];
  vehicles?: Vehicle[];
  onNavigateToPerformance?: (supplierId: string) => void;
}

const DEFAULT_EVENT_PREFS: NotificationEventPreferences = {
  NEW_REQUEST: true,
  REQUEST_REVISION: true,
  REQUEST_CANCELLED: true,
  NEW_DEADLINE: true,
  VEHICLE_APPROVED: true,
  VEHICLE_REJECTED: true,
};

export const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({
  suppliers,
  requests = [],
  assignments = [],
  vehicles = [],
  onNavigateToPerformance,
}) => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'ADMIN';

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'>('ALL');

  // Derive Notification Settings Map directly from live suppliers collection
  const notifSettingsMap = useMemo(() => {
    const map: Record<string, SupplierNotificationSettings> = {};
    suppliers.forEach((s) => {
      map[s.id] = {
        supplierId: s.id,
        email: s.email || '',
        pendingEmail: s.pendingEmail || '',
        emailVerified: s.emailVerified !== false,
        emailEnabled: s.emailEnabled !== false,
        pushEnabled: s.pushEnabled !== false,
        inAppEnabled: s.inAppEnabled !== false,
        mandatoryCriticalPolicy: Boolean(s.mandatoryCriticalPolicy),
        eventPreferences: {
          ...DEFAULT_EVENT_PREFS,
          ...(s.eventPreferences || {}),
        },
        updatedAt: s.updatedAt,
      };
    });
    return map;
  }, [suppliers]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [passwordModalSupplier, setPasswordModalSupplier] = useState<Supplier | null>(null);
  const [deleteModalSupplier, setDeleteModalSupplier] = useState<Supplier | null>(null);
  const [notifModalSupplier, setNotifModalSupplier] = useState<Supplier | null>(null);

  // Notification Modal Form State
  const [prefEmailEnabled, setPrefEmailEnabled] = useState(true);
  const [prefPushEnabled, setPrefPushEnabled] = useState(true);
  const [prefInAppEnabled, setPrefInAppEnabled] = useState(true);
  const [prefMandatoryPolicy, setPrefMandatoryPolicy] = useState(false);
  const [prefEvents, setPrefEvents] = useState<NotificationEventPreferences>(DEFAULT_EVENT_PREFS);

  // Form States - Create
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newTaxNumber, setNewTaxNumber] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Form States - Edit
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTaxNumber, setEditTaxNumber] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Form State - Reset Password
  const [resetNewPassword, setResetNewPassword] = useState('');

  // Action Loading & Feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (statusFilter === 'ACTIVE' && s.active === false) return false;
      if (statusFilter === 'INACTIVE' && (s.active !== false || s.archived)) return false;
      if (statusFilter === 'ARCHIVED' && !s.archived) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = s.companyName.toLowerCase().includes(term);
        const matchContact = s.contactPerson?.toLowerCase().includes(term);
        const matchPhone = s.phone?.toLowerCase().includes(term);
        const matchEmail = s.email?.toLowerCase().includes(term);
        const matchUser = s.username?.toLowerCase().includes(term);
        const matchId = s.id.toLowerCase().includes(term);
        if (!matchName && !matchContact && !matchPhone && !matchEmail && !matchUser && !matchId) {
          return false;
        }
      }
      return true;
    });
  }, [suppliers, statusFilter, searchTerm]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((s) => s.active !== false && !s.archived).length;
    const inactive = suppliers.filter((s) => s.active === false && !s.archived).length;
    const archived = suppliers.filter((s) => s.archived).length;
    return { total, active, inactive, archived };
  }, [suppliers]);

  // Open Edit Modal
  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setEditCompanyName(s.companyName);
    setEditContactPerson(s.contactPerson);
    setEditPhone(s.phone);
    setEditEmail(s.email);
    setEditAddress(s.address || '');
    setEditTaxNumber(s.taxNumber || '');
    setEditDescription(s.description || '');
    setEditActive(s.active !== false);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setNewCompanyName('');
    setNewContactPerson('');
    setNewPhone('');
    setNewEmail('');
    setNewAddress('');
    setNewTaxNumber('');
    setNewUsername('');
    setNewPassword('');
    setNewDescription('');
    setNewActive(true);
    setShowPassword(false);
    setIsCreateModalOpen(true);
  };

  // Auto-generate suggested username when company name changes
  const handleCompanyNameChange = (val: string) => {
    setNewCompanyName(val);
    if (!newUsername || newUsername.startsWith('tedarik_') || newUsername === '') {
      const slug = val
        .trim()
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 20);
      setNewUsername(slug || '');
    }
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim() || !newContactPerson.trim() || !newPhone.trim() || !newEmail.trim() || !newUsername.trim()) {
      setFeedback({ type: 'error', message: 'Lütfen zorunlu alanları doldurunuz.' });
      return;
    }
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await createSupplier({
        companyName: newCompanyName.trim(),
        contactPerson: newContactPerson.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        address: newAddress.trim(),
        taxNumber: newTaxNumber.trim(),
        username: newUsername.trim(),
        password: newPassword,
        description: newDescription.trim(),
        active: newActive,
      });

      setFeedback({
        type: 'success',
        message: `"${res.supplier.companyName}" tedarikçisi ve kullanıcı hesabı (@${res.user.username}) başarıyla oluşturuldu!`,
      });
      setIsCreateModalOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Tedarikçi eklenemedi.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    if (!editCompanyName.trim() || !editContactPerson.trim() || !editPhone.trim() || !editEmail.trim()) {
      setFeedback({ type: 'error', message: 'Lütfen zorunlu alanları doldurunuz.' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      await updateSupplier({
        supplierId: editingSupplier.id,
        companyName: editCompanyName.trim(),
        contactPerson: editContactPerson.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        taxNumber: editTaxNumber.trim(),
        description: editDescription.trim(),
        active: editActive,
      });

      setFeedback({
        type: 'success',
        message: `"${editCompanyName}" bilgileri başarıyla güncellendi.`,
      });
      setEditingSupplier(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Güncelleme başarısız.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Password Reset
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalSupplier) return;
    if (!resetNewPassword || resetNewPassword.length < 6) {
      setFeedback({ type: 'error', message: 'Yeni şifre en az 6 karakter olmalıdır.' });
      return;
    }

    setActionLoading(true);
    try {
      const msg = await resetSupplierPassword(passwordModalSupplier.id, resetNewPassword);
      setFeedback({ type: 'success', message: msg || 'Tedarikçi şifresi güncellendi.' });
      setPasswordModalSupplier(null);
      setResetNewPassword('');
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Şifre güncellenemedi.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (s: Supplier) => {
    setActionLoading(true);
    try {
      const newStatus = !s.active;
      await toggleSupplierActive(s.id, newStatus);
      setFeedback({
        type: 'success',
        message: `"${s.companyName}" ${newStatus ? 'aktif edildi' : 'pasife alındı ve oturumu askıya alındı'}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Durum değiştirilemedi.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete or Archive
  const handleConfirmDelete = async (forceDelete: boolean) => {
    if (!deleteModalSupplier) return;
    setActionLoading(true);
    try {
      const res = await deleteOrArchiveSupplier(deleteModalSupplier.id, forceDelete);
      setFeedback({ type: 'success', message: res.message });
      setDeleteModalSupplier(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'İşlem başarısız.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Security Access Guard
  if (!isAdmin) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-12">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-base font-black text-rose-900">Erişim Yetkisi Bulunmuyor</h2>
        <p className="text-xs text-rose-700 mt-1 leading-relaxed">
          Tedarikçi Yönetimi ve yetkilendirme modülü yalnızca Sistem Yöneticisi (ADMIN) rolü tarafından görüntülenebilir ve yönetilebilir.
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
              Tedarikçi Yönetim Merkezi
            </h1>
            <span className="bg-[#FFD000] text-[#092B60] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              ADMIN ÖZEL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dinamik lojistik iş ortakları, firma hesapları, kullanıcı giriş yetkileri ve kota optimizasyonu
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-98 shrink-0"
        >
          <Plus className="w-4 h-4 text-[#FFD000]" />
          <span>Yeni Tedarikçi Ekle</span>
        </button>
      </div>

      {/* Global Feedback Banner */}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-[#092B60]">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">TOPLAM TEDARİKÇİ</span>
          <span className="text-2xl font-black text-[#092B60] block mt-1">{kpis.total}</span>
          <span className="text-[10px] text-slate-400 font-medium">Sistemde kayıtlı firma</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-emerald-600">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">AKTİF ORTAKLAR</span>
          <span className="text-2xl font-black text-emerald-700 block mt-1">{kpis.active}</span>
          <span className="text-[10px] text-slate-400 font-medium">Talep atanabilir & giriş açık</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-amber-500">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">PASİFE ALINANLAR</span>
          <span className="text-2xl font-black text-amber-700 block mt-1">{kpis.inactive}</span>
          <span className="text-[10px] text-slate-400 font-medium">Geçici askıya alınan</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-slate-400">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">ARŞİVLENEN</span>
          <span className="text-2xl font-black text-slate-700 block mt-1">{kpis.archived}</span>
          <span className="text-[10px] text-slate-400 font-medium">Geçmişi korunan kayıt</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Firma adı, yetkili, telefon veya kullanıcı adı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#092B60] focus:border-[#092B60]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'ALL', label: 'Tümü' },
            { id: 'ACTIVE', label: 'Aktifler' },
            { id: 'INACTIVE', label: 'Pasifler' },
            { id: 'ARCHIVED', label: 'Arşiv' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                statusFilter === f.id
                  ? 'bg-[#092B60] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="bg-[#092B60] text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#A7F36B]" />
            <h3 className="font-bold text-sm">Tüm Tedarikçi Firmalar & Hesap Detayları</h3>
          </div>
          <span className="text-xs text-blue-200 font-medium">
            {filteredSuppliers.length} firma listeleniyor
          </span>
        </div>

        {filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold">Eşleşen tedarikçi firma bulunamadı.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                  <th className="p-3.5">FİRMA ADI & ID</th>
                  <th className="p-3.5">YETKİLİ KİŞİ</th>
                  <th className="p-3.5">E-POSTA & TELEFON</th>
                  <th className="p-3.5">E-POSTA DOĞRULAMA DURUMU</th>
                  <th className="p-3.5">BİLDİRİM TERCİHLERİ</th>
                  <th className="p-3.5">KULLANICI ADI</th>
                  <th className="p-3.5 text-center">DURUM</th>
                  <th className="p-3.5 text-right">İŞLEMLER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSuppliers.map((s) => {
                  const isArchived = Boolean(s.archived);
                  const isActive = s.active !== false && !isArchived;
                  const sNotif = notifSettingsMap[s.id];
                  const isEmailVerified = (sNotif?.emailVerified ?? s.emailVerified) !== false;
                  const pendingEmail = sNotif?.pendingEmail || s.pendingEmail || '';
                  const emailEnabled = sNotif ? sNotif.emailEnabled !== false : true;
                  const pushEnabled = sNotif ? sNotif.pushEnabled !== false : true;
                  const inAppEnabled = sNotif ? sNotif.inAppEnabled !== false : true;
                  const mandatoryPolicy = Boolean(sNotif?.mandatoryCriticalPolicy);

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isActive ? 'bg-slate-50/40 text-slate-500' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="font-bold text-[#092B60] text-sm flex items-center gap-2">
                          <span>{s.companyName}</span>
                          {s.taxNumber && (
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                              VN: {s.taxNumber}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          ID: {s.id}
                        </div>
                        {s.address && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-xs">{s.address}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{s.contactPerson}</span>
                        </div>
                        {s.description && (
                          <div className="text-[11px] text-slate-400 mt-0.5 italic truncate max-w-xs">
                            {s.description}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                          <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{s.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="font-medium">{sNotif?.email || s.email}</span>
                        </div>
                      </td>

                      {/* E-POSTA DOĞRULAMA DURUMU */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {isEmailVerified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                              <CheckCircle2 className="w-3 h-3" />
                              DOĞRULANDI (AKTİF)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black">
                              <AlertTriangle className="w-3 h-3" />
                              DOĞRULAMA BEKLİYOR
                            </span>
                          )}
                          {pendingEmail && (
                            <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 space-y-1">
                              <div className="font-bold">Yeni E-posta Onay Bekliyor:</div>
                              <div className="font-mono truncate max-w-[160px]">{pendingEmail}</div>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await verifySupplierEmail({ supplierId: s.id, adminDirectVerify: true });
                                    setFeedback({
                                      type: 'success',
                                      message: `${s.companyName} için yeni e-posta (${pendingEmail}) doğrulandı ve aktif edildi.`,
                                    });
                                  } catch (err: any) {
                                    setFeedback({ type: 'error', message: err.message });
                                  }
                                }}
                                className="px-2 py-0.5 rounded bg-[#092B60] text-[#FFD000] font-black text-[9px] hover:bg-[#0D3978]"
                              >
                                Hemen Doğrula & Aktifleştir
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* BİLDİRİM TERCİHLERİ */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                              emailEnabled
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            <Mail className="w-2.5 h-2.5" />
                            E-Posta
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                              pushEnabled
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            <Smartphone className="w-2.5 h-2.5" />
                            Push
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                              inAppEnabled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            <Bell className="w-2.5 h-2.5" />
                            Uygulama İçi
                          </span>
                        </div>
                        {mandatoryPolicy && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-black">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Zorunlu Kritik Bildirim Politikası Aktif
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg font-mono font-bold text-xs inline-flex items-center gap-1.5 border border-slate-200">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>{s.username || s.id.replace(/-/g, '_')}</span>
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        {isArchived ? (
                          <span className="bg-slate-200 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            ARŞİVLENDİ
                          </span>
                        ) : isActive ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            AKTİF
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                            <Power className="w-3 h-3" />
                            PASİF
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Notification Preferences Modal Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setNotifModalSupplier(s);
                              setPrefEmailEnabled(sNotif ? sNotif.emailEnabled !== false : true);
                              setPrefPushEnabled(sNotif ? sNotif.pushEnabled !== false : true);
                              setPrefInAppEnabled(sNotif ? sNotif.inAppEnabled !== false : true);
                              setPrefMandatoryPolicy(Boolean(sNotif?.mandatoryCriticalPolicy));
                              setPrefEvents({
                                ...DEFAULT_EVENT_PREFS,
                                ...(sNotif?.eventPreferences || {}),
                              });
                            }}
                            className="p-2 text-blue-700 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Bildirim Tercihleri & Kritik Bildirim Politikasını Yönet"
                          >
                            <Bell className="w-4 h-4" />
                          </button>

                          {/* Toggle Active / Inactive */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(s)}
                            disabled={actionLoading}
                            className={`p-2 rounded-xl transition-colors ${
                              s.active !== false
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={s.active !== false ? 'Firmayı Pasife Al (Girişini Durdur)' : 'Firmayı Tekrar Aktifleştir'}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordModalSupplier(s);
                              setResetNewPassword('');
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="Tedarikçi Giriş Şifresini Sıfırla"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-2 text-slate-600 hover:text-[#092B60] hover:bg-slate-100 rounded-xl transition-colors"
                            title="Firma Bilgilerini Düzenle"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete / Archive */}
                          <button
                            type="button"
                            onClick={() => setDeleteModalSupplier(s)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Tedarikçiyi Sil / Arşivle"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. YENİ TEDARİKÇİ EKLEME MODALI */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#092B60] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#A7F36B]" />
                <div>
                  <h3 className="text-base font-bold">Yeni Tedarikçi Firma & Portal Hesabı Ekle</h3>
                  <p className="text-xs text-blue-100">Firma bilgileri ve tedarikçi giriş yetkisi birlikte tanımlanır</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4">
              {/* Firma Adı & Yetkili */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Firma Adı *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Güven Lojistik A.Ş."
                    value={newCompanyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-semibold focus:ring-2 focus:ring-[#092B60]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Yetkili Kişi Adı *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Ahmet Yılmaz"
                    value={newContactPerson}
                    onChange={(e) => setNewContactPerson(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium focus:ring-2 focus:ring-[#092B60]"
                  />
                </div>
              </div>

              {/* Telefon & E-posta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Telefon Numarası *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+90 5XX XXX XX XX"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-[#092B60]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    E-Posta Adresi *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="operasyon@guvenlojistik.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium focus:ring-2 focus:ring-[#092B60]"
                  />
                </div>
              </div>

              {/* Kullanıcı Giriş Bilgileri Kartı */}
              <div className="p-3.5 bg-[#F4F7FC] rounded-xl border border-blue-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#092B60] uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-[#0D3978]" />
                  <span>Tedarikçi Portal Giriş Hesabı</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Kullanıcı Adı (Giriş İçin) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="guven_lojistik"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono font-bold bg-white focus:ring-2 focus:ring-[#092B60]"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Küçük harf, rakam ve alt çizgi</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      İlk Giriş Şifresi *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="En az 6 karakter"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full text-xs p-2.5 pr-8 rounded-lg border border-slate-300 font-mono bg-white focus:ring-2 focus:ring-[#092B60]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Şifre PBKDF2 ile şifrelenir</span>
                  </div>
                </div>
              </div>

              {/* Firma Adresi & Vergi Numarası */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vergi Numarası (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    placeholder="10 haneli vergi no"
                    value={newTaxNumber}
                    onChange={(e) => setNewTaxNumber(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Açıklama / Filo Notu
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 20 TIR filolu Ege bölgesi ortağı"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Firma Adresi (Opsiyonel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Firma açık adresi, şehir veya tesis bilgisi..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>

              {/* Aktiflik Durumu */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newActive"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="rounded text-[#092B60] w-4 h-4"
                />
                <label htmlFor="newActive" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Tedarikçi Aktif (Yeni talep alabilir ve sisteme giriş yapabilir)
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-98"
                >
                  {actionLoading ? 'Oluşturuluyor...' : 'Tedarikçiyi ve Hesabı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TEDARİKÇİ DÜZENLEME MODALI */}
      {/* ========================================================================= */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#092B60] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-5 h-5 text-[#A7F36B]" />
                <div>
                  <h3 className="text-base font-bold">Tedarikçi Bilgilerini Düzenle</h3>
                  <p className="text-xs text-blue-100">{editingSupplier.companyName} ({editingSupplier.id})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSupplier(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Firma Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Yetkili Kişi *
                  </label>
                  <input
                    type="text"
                    required
                    value={editContactPerson}
                    onChange={(e) => setEditContactPerson(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Telefon *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    E-Posta *
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vergi Numarası
                  </label>
                  <input
                    type="text"
                    value={editTaxNumber}
                    onChange={(e) => setEditTaxNumber(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Açıklama / Filo Notu
                  </label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Firma Adresi
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded text-[#092B60] w-4 h-4"
                />
                <label htmlFor="editActive" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Tedarikçi Aktif (Talep atamaları ve portal girişi serbest)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black px-5 py-2.5 rounded-xl text-xs shadow-md"
                >
                  {actionLoading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ŞİFRE SIFIRLAMA MODALI */}
      {/* ========================================================================= */}
      {passwordModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-[#092B60] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-[#FFD000]" />
                <h3 className="text-base font-bold">Tedarikçi Şifresini Sıfırla</h3>
              </div>
              <button
                onClick={() => setPasswordModalSupplier(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                <strong>{passwordModalSupplier.companyName}</strong> firmasının portal giriş şifresi sıfırlanacaktır.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Yeni Şifre (En az 6 karakter) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Yeni şifreyi giriniz"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalSupplier(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2 rounded-xl text-xs shadow-md"
                >
                  {actionLoading ? 'İşleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SİLME VE ARŞİVLEME ONAY MODALI */}
      {/* ========================================================================= */}
      {deleteModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-bold">Tedarikçi Silme veya Arşivleme</h3>
              </div>
              <button
                onClick={() => setDeleteModalSupplier(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold">
                  "{deleteModalSupplier.companyName}" firmasını sistemden kaldırmak üzeresiniz.
                </p>
                <p className="text-[11px] text-amber-800">
                  Geçmiş sefer ve talep kayıtlarının bütünlüğünü korumak adına sistem varsayılan olarak firmayı <strong>Pasife Alarak Arşivler</strong>.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-emerald-600" />
                    <span>A) Güvenli Arşivle & Pasife Al (Önerilen)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tedarikçinin yeni taleplere atanmasını ve sisteme girişini engeller. Tüm geçmiş sefer, araç ve kota raporları korunur.
                  </p>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleConfirmDelete(false)}
                    className="w-full bg-[#092B60] hover:bg-[#0D3978] text-white font-bold py-2 rounded-xl text-xs transition-colors"
                  >
                    {actionLoading ? 'İşleniyor...' : 'Güvenli Şekilde Arşivle & Pasife Al'}
                  </button>
                </div>

                <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200 space-y-2">
                  <div className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>B) Kalıcı Olarak Sil (Geri Alınamaz)</span>
                  </div>
                  <p className="text-[11px] text-rose-700">
                    Firmayı ve kullanıcı hesabını kalıcı olarak siler. Yalnızca yanlışlıkla açılmış ve sefer kaydı bulunmayan hesaplar için önerilir.
                  </p>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleConfirmDelete(true)}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                  >
                    {actionLoading ? 'Siliniyor...' : 'Evet, Kalıcı Olarak Sil'}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteModalSupplier(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TEDARİKÇİ BİLDİRİM TERCİHLERİ & ZORUNLU KRİTİK POLİTİKA MODALI */}
      {/* ========================================================================= */}
      {notifModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-[#092B60] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#FFD000]" />
                <div>
                  <h3 className="text-base font-bold">Bildirim Tercihleri & Zorunlu Kritik Politika</h3>
                  <p className="text-xs text-blue-200">
                    {notifModalSupplier.companyName} ({notifModalSupplier.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifModalSupplier(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Zorunlu Kritik Bildirim Politikası */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefMandatoryPolicy}
                    onChange={(e) => setPrefMandatoryPolicy(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#092B60]"
                  />
                  <div>
                    <div className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      <span>Zorunlu Kritik Bildirim Politikası (Admin Override)</span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Aktifleştirildiğinde; Yeni Araç Talebi, Revizyon, İptal ve Yeni Termin gibi kritik operasyonel bildirimler tedarikçi tercihlerini kapatsa bile zorunlu olarak gönderilir.
                    </p>
                  </div>
                </label>
              </div>

              {/* Kanal Tercihleri */}
              <div className="space-y-2">
                <div className="text-xs font-black text-[#092B60] uppercase tracking-wider">
                  1. Bildirim Kanalları
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefEmailEnabled}
                      onChange={(e) => setPrefEmailEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-[#092B60]"
                    />
                    <span className="font-bold text-xs text-slate-800">E-Posta Bildirimleri</span>
                  </label>
                  <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefPushEnabled}
                      onChange={(e) => setPrefPushEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-[#092B60]"
                    />
                    <span className="font-bold text-xs text-slate-800">Telefon Push</span>
                  </label>
                  <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefInAppEnabled}
                      onChange={(e) => setPrefInAppEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-[#092B60]"
                    />
                    <span className="font-bold text-xs text-slate-800">Uygulama İçi</span>
                  </label>
                </div>
              </div>

              {/* Olay Bazlı Tercihler */}
              <div className="space-y-2">
                <div className="text-xs font-black text-[#092B60] uppercase tracking-wider">
                  2. Olay Bazlı Bildirim Tercihleri
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'NEW_REQUEST', label: 'Yeni Araç Talebi' },
                    { key: 'REQUEST_REVISION', label: 'Araç Talebi Revizyonu' },
                    { key: 'REQUEST_CANCELLED', label: 'Araç Talebi İptali' },
                    { key: 'NEW_DEADLINE', label: 'Yeni Termin Bilgisi' },
                    { key: 'VEHICLE_APPROVED', label: 'Araç Onayı' },
                    { key: 'VEHICLE_REJECTED', label: 'Araç Reddi' },
                  ].map((ev) => (
                    <label
                      key={ev.key}
                      className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={prefEvents[ev.key as keyof NotificationEventPreferences] !== false}
                        onChange={(e) =>
                          setPrefEvents((prev) => ({
                            ...prev,
                            [ev.key]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-[#092B60]"
                      />
                      <span className="font-bold text-xs text-slate-700">{ev.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNotifModalSupplier(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      await updateSupplierNotificationSettings({
                        supplierId: notifModalSupplier.id,
                        emailEnabled: prefEmailEnabled,
                        pushEnabled: prefPushEnabled,
                        inAppEnabled: prefInAppEnabled,
                        mandatoryCriticalPolicy: prefMandatoryPolicy,
                        eventPreferences: prefEvents,
                      });
                      setFeedback({
                        type: 'success',
                        message: `${notifModalSupplier.companyName} bildirim tercihleri ve kritik politika ayarları kaydedildi.`,
                      });
                      setNotifModalSupplier(null);
                    } catch (err: any) {
                      setFeedback({ type: 'error', message: err.message });
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl text-xs shadow-md"
                >
                  {actionLoading ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
