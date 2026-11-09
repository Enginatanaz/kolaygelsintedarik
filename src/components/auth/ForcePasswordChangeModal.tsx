import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getSessionToken } from '../../context/AuthContext';

interface ForcePasswordChangeModalProps {
  onSuccess: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Lütfen tüm alanları doldurunuz.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Yeni şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Yeni şifreler eşleşmiyor. Lütfen tekrar kontrol ediniz.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMsg('Yeni şifreniz mevcut ilk giriş şifrenizle aynı olamaz.');
      return;
    }

    setLoading(true);

    try {
      const token = getSessionToken();
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          sessionToken: token,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Şifre değiştirilemedi.');
      }

      setSuccessMsg('Şifreniz başarıyla değiştirildi. Yönlendiriliyorsunuz...');
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Şifre değiştirilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#092B60]/20 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#092B60] p-6 text-white text-center border-b border-[#0D3978]">
          <div className="w-12 h-12 bg-[#FFD000] text-[#092B60] rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-md">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black tracking-tight">İlk Giriş Şifre Değişimi Zorunlu</h2>
          <p className="text-xs text-blue-200 mt-1 font-medium">
            Güvenliğiniz için yönetici tarafından verilen geçici ilk şifrenizi güncellemeniz gerekmektedir.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs font-sans">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-bold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Current Password */}
            <div>
              <label className="block font-bold text-[#092B60] mb-1">Mevcut (Geçici) Şifre *</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Geçici şifreniz"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#092B60] focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block font-bold text-[#092B60] mb-1">Yeni Kalıcı Şifre * (En az 6 karakter)</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Yeni güvenli şifreniz"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#092B60] focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block font-bold text-[#092B60] mb-1">Yeni Şifre Tekrar *</label>
              <input
                type="password"
                placeholder="Yeni şifrenizi doğrulayınız"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#092B60] focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 text-xs flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span>Şifre Güncelleniyor...</span>
              ) : (
                <span>Yeni Şifreyi Kaydet & Sisteme Gir</span>
              )}
            </button>
          </form>

          <div className="pt-2 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Şifreniz kimseyle paylaşılmaz ve güvenli şifreleme algoritması ile saklanır.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
