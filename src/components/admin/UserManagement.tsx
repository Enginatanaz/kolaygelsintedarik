import React, { useState } from 'react';
import { UserProfile, UserRole, Supplier } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building2,
  Radio,
  CheckCircle,
  XCircle,
  KeyRound,
  AlertCircle,
  Check,
  Search,
} from 'lucide-react';

interface UserManagementProps {
  users: UserProfile[];
  suppliers: Supplier[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, suppliers }) => {
  const { currentUser, sessionToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // New user form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('OPERATOR');
  const [newSupplierId, setNewSupplierId] = useState(suppliers[0]?.id || '');
  const [newPhone, setNewPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Reset password state
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone || '').includes(searchTerm);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAddError(null);
    setAddSuccess(null);

    if (!newUsername.trim() || !newPassword || !newFullName.trim()) {
      setAddError('Kullanıcı adı, şifre ve isim soyisim zorunludur.');
      return;
    }

    if (newPassword.length < 6) {
      setAddError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminToken: sessionToken,
          username: newUsername,
          password: newPassword,
          fullName: newFullName,
          role: newRole,
          supplierId: newRole === 'SUPPLIER' ? newSupplierId : undefined,
          phone: newPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kullanıcı oluşturulamadı.');
      }

      setAddSuccess(`Kullanıcı (${newUsername}) başarıyla oluşturuldu.`);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewPhone('');
      setTimeout(() => {
        setShowAddModal(false);
        setAddSuccess(null);
      }, 1500);
    } catch (err: any) {
      setAddError(err.message || 'Kullanıcı eklenemedi.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleActive = async (targetUser: UserProfile) => {
    if (!currentUser || !sessionToken) return;
    try {
      await fetch('/api/admin/toggle-user-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminToken: sessionToken,
          targetUid: targetUser.uid,
          active: !targetUser.active,
        }),
      });
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const handleResetPassword = async () => {
    if (!currentUser || !resetModalUser || !resetPasswordInput || !sessionToken) return;
    setResetLoading(true);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminToken: sessionToken,
          targetUid: resetModalUser.uid,
          newPassword: resetPasswordInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız.');

      setResetSuccess(`${resetModalUser.username || resetModalUser.fullName} için şifre güncellendi.`);
      setTimeout(() => {
        setResetModalUser(null);
        setResetPasswordInput('');
        setResetSuccess(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Şifre güncellenemedi.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleMustChangePassword = async (targetUser: UserProfile) => {
    if (!currentUser || !sessionToken) return;
    try {
      await fetch('/api/admin/toggle-must-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminToken: sessionToken,
          targetUid: targetUser.uid,
          mustChangePassword: !targetUser.mustChangePassword,
        }),
      });
    } catch (err) {
      console.error('Toggle mustChangePassword error:', err);
    }
  };

  const initialRequiredAccounts = [
    { username: 'tdr_admin_26', role: 'ADMIN', label: 'Yönetici (Admin)', detail: 'Tüm yetkiler' },
    { username: 'tdr_operator_01', role: 'OPERATOR', label: 'Operatör 1', detail: 'Tesis Operasyonu' },
    { username: 'tdr_operator_02', role: 'OPERATOR', label: 'Operatör 2', detail: 'Tesis Operasyonu' },
    { username: 'tdr_operator_03', role: 'OPERATOR', label: 'Operatör 3', detail: 'Tesis Operasyonu' },
    { username: 'dnz_tdrk_84x', role: 'SUPPLIER', label: 'Deniz Lojistik', detail: 'deniz-lojistik' },
    { username: 'alp_loj_72k9', role: 'SUPPLIER', label: 'Alp Özler Lojistik', detail: 'alp-ozler-lojistik' },
    { username: 'ekl_tdr_93m', role: 'SUPPLIER', label: 'Ekol Lojistik', detail: 'ekol-lojistik' },
    { username: 'tkn_loj_61p8', role: 'SUPPLIER', label: 'Tekno Lojistik', detail: 'tekno-lojistik' },
  ];

  return (
    <div className="space-y-4 text-xs">
      {/* Top Header & New User Button */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#092B60] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#092B60]" />
            Kullanıcı & Hesap Yönetimi
          </h2>
          <p className="text-slate-500 text-[11px]">
            Tedarik360 rol bazlı kullanıcı hesaplarını yönetin, şifre sıfırlayın veya ilk giriş şifre değiştirme zorunluluğunu ayarlayın.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] px-4 py-2 rounded-lg font-black shadow-sm transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4 text-[#FFD000]" />
          <span>Yeni Kullanıcı Oluştur</span>
        </button>
      </div>

      {/* Corporate Account Status Dashboard Card */}
      <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FFD000]" />
            <h3 className="font-black text-xs text-white">Sistem Tanımlı Başlangıç Hesapları (8 Yetkili Hesap)</h3>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
            PBKDF2 Hashed & Salted
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {initialRequiredAccounts.map((reqAcc) => {
            const foundUser = users.find((u) => u.username === reqAcc.username);
            const isCreated = Boolean(foundUser);
            const isMustChange = foundUser?.mustChangePassword;

            return (
              <div
                key={reqAcc.username}
                className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono font-black text-amber-400 text-[11px] truncate">{reqAcc.username}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                        reqAcc.role === 'ADMIN'
                          ? 'bg-[#FFD000] text-[#092B60]'
                          : reqAcc.role === 'OPERATOR'
                          ? 'bg-blue-900 text-blue-200'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {reqAcc.role}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[10px] font-bold truncate">{reqAcc.label}</div>
                  <div className="text-slate-500 text-[9px] font-mono truncate">{reqAcc.detail}</div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center justify-between text-[9px]">
                  {isCreated ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Tanımlı
                    </span>
                  ) : (
                    <span className="text-slate-500 font-bold">Bekliyor</span>
                  )}

                  {isMustChange ? (
                    <span className="text-amber-300 font-bold" title="İlk girişte şifre değişimi zorunlu">
                      Şifre Yenileme
                    </span>
                  ) : (
                    <span className="text-slate-400 font-bold">Aktif Güncel</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Kullanıcı adı, isim veya telefon ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#092B60] font-bold text-slate-800"
        >
          <option value="ALL">Tüm Roller</option>
          <option value="ADMIN">Yöneticiler (Admin)</option>
          <option value="OPERATOR">Operatörler</option>
          <option value="SUPPLIER">Tedarikçi Temsilcileri</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div className="p-4 bg-[#092B60] text-white flex items-center justify-between">
          <h3 className="font-black text-sm text-white">Sistem Kullanıcı Listesi ({filteredUsers.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0D3978] text-white uppercase text-[10px] font-black border-b border-blue-900">
              <tr>
                <th className="px-4 py-3">Kullanıcı Adı</th>
                <th className="px-4 py-3">Adı Soyadı</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Bağlı Tedarikçi</th>
                <th className="px-4 py-3">Şifre Durumu</th>
                <th className="px-4 py-3">Hesap Durumu</th>
                <th className="px-4 py-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const sup = suppliers.find((s) => s.id === u.supplierId);
                return (
                  <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-black text-[#092B60]">
                      {u.username || u.email.split('@')[0]}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-800">{u.fullName}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black ${
                          u.role === 'ADMIN'
                            ? 'bg-[#FFD000] text-[#092B60]'
                            : u.role === 'OPERATOR'
                            ? 'bg-[#EAF3FF] text-[#092B60] border border-blue-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {u.role === 'ADMIN' ? 'Yönetici' : u.role === 'OPERATOR' ? 'Operatör' : 'Tedarikçi'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-700 font-bold">
                      {u.role === 'SUPPLIER' ? sup?.companyName || u.supplierId || '-' : '-'}
                    </td>

                    <td className="px-4 py-3">
                      {u.mustChangePassword ? (
                        <span
                          onClick={() => handleToggleMustChangePassword(u)}
                          className="inline-flex items-center gap-1 text-amber-800 font-bold text-[10px] bg-amber-50 px-2 py-0.5 rounded border border-amber-300 cursor-pointer hover:bg-amber-100"
                          title="Tıklayarak ilk giriş zorunluluğunu kaldırabilirsiniz"
                        >
                          <KeyRound className="w-3 h-3 text-amber-600" />
                          İlk Giriş Değişimi Zorunlu
                        </span>
                      ) : (
                        <span
                          onClick={() => handleToggleMustChangePassword(u)}
                          className="inline-flex items-center gap-1 text-slate-600 font-bold text-[10px] bg-slate-100 px-2 py-0.5 rounded cursor-pointer hover:bg-slate-200"
                          title="Tıklayarak ilk giriş şifre değişimini zorunlu kılabilirsiniz"
                        >
                          <Check className="w-3 h-3 text-slate-500" />
                          Güncel / Standart
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {u.active !== false ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-bold text-[11px] bg-[#A7F36B]/30 px-2 py-0.5 rounded">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Pasif / Askıda
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle Active/Inactive */}
                        <button
                          onClick={() => handleToggleActive(u)}
                          title={u.active !== false ? 'Hesabı Askıya Al' : 'Hesabı Aktifleştir'}
                          className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                            u.active !== false
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {u.active !== false ? 'Pasife Al' : 'Aktifleştir'}
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => {
                            setResetModalUser(u);
                            setResetPasswordInput('');
                          }}
                          title="Şifre Sıfırla"
                          className="p-1.5 bg-[#0D3978] hover:bg-[#092B60] text-white rounded transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Kullanıcı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE USER */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in border border-[#092B60]/20">
            <h3 className="font-bold text-sm text-[#092B60] mb-1 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#092B60]" />
              Yeni Kullanıcı Hesabı Tanımla
            </h3>
            <p className="text-slate-500 mb-4 text-[11px]">
              Kullanıcı adı ve şifre sistem yöneticisi tarafından güvenli şekilde atanır.
            </p>

            {addError && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}
            {addSuccess && (
              <div className="mb-3 p-2.5 bg-[#A7F36B]/20 border border-emerald-400 text-emerald-950 rounded-lg flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 shrink-0" />
                <span>{addSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Kullanıcı Adı *</label>
                <input
                  type="text"
                  placeholder="örn: operator_ali veya deniz_ali"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Şifre * (En az 6 karakter)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#092B60] mb-1">Adı Soyadı *</label>
                <input
                  type="text"
                  placeholder="Ad Soyad"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Sistem Rolü *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="OPERATOR">Operatör</option>
                    <option value="SUPPLIER">Tedarikçi</option>
                    <option value="ADMIN">Yönetici (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Telefon</label>
                  <input
                    type="text"
                    placeholder="+90 532 ..."
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {newRole === 'SUPPLIER' && (
                <div>
                  <label className="block font-bold text-[#092B60] mb-1">Tedarikçi Firma *</label>
                  <select
                    value={newSupplierId}
                    onChange={(e) => setNewSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-bold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-1.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-bold rounded-lg shadow-sm transition-colors"
                >
                  {addLoading ? 'Kaydediliyor...' : 'Hesabı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in border border-[#092B60]/20">
            <h3 className="font-bold text-sm text-[#092B60] mb-1 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#092B60]" />
              Şifre Sıfırlama
            </h3>
            <p className="text-slate-500 mb-4 text-[11px]">
              <strong>{resetModalUser.username || resetModalUser.fullName}</strong> kullanıcısı için yeni şifre belirleyin.
            </p>

            {resetSuccess && (
              <div className="mb-3 p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                {resetSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-[#092B60] mb-1">Yeni Şifre</label>
                <input
                  type="password"
                  placeholder="En az 6 karakter"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-bold"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading || resetPasswordInput.length < 6}
                className="px-4 py-1.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-bold rounded-lg shadow-sm transition-colors"
              >
                {resetLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
