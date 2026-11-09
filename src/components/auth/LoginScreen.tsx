import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Truck, ShieldCheck, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { loginWithUsername } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Lütfen kullanıcı adı ve şifrenizi giriniz.');
      return;
    }

    setLoading(true);
    try {
      await loginWithUsername(username, password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#092B60] flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Subtle Graphic Grids */}
      <div className="absolute inset-0 bg-[radial-gradient(#0D3978_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 animate-in fade-in duration-300">
        {/* Top Header */}
        <div className="bg-[#092B60] p-7 text-center text-white relative border-b border-[#0D3978]">
          <div className="w-14 h-14 rounded-2xl bg-[#FFD000] text-[#092B60] flex items-center justify-center mx-auto mb-3 shadow-lg font-black">
            <Truck className="w-8 h-8 text-[#092B60]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-sans">
            TEDARİK<span className="text-[#FFD000]">360</span>
          </h1>
          <p className="text-xs text-blue-200 mt-1 font-medium">
            Araç Tedarik & Lojistik Operasyon Yönetim Platformu
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-base font-bold text-[#092B60]">Kurumsal Portal Girişi</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tanımlanmış kullanıcı bilgilerinizle güvenli oturum açınız.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 font-bold">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Username Input */}
            <div>
              <label className="block font-bold text-[#092B60] mb-1.5">
                Kullanıcı Adı
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4 text-[#092B60]" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı giriniz"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#092B60] text-slate-900 font-bold placeholder:text-slate-400 text-xs"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block font-bold text-[#092B60] mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-[#092B60]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi giriniz"
                  className="w-full pl-10 pr-10 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#092B60] text-slate-900 font-bold placeholder:text-slate-400 text-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl shadow-md transition-all active:scale-98 disabled:opacity-50 text-xs flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#FFD000] border-t-transparent rounded-full animate-spin" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <span>Güvenli Giriş Yap</span>
              )}
            </button>
          </form>

          {/* Secure System Notice */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-500 text-center font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Firebase Güvenli Kimlik Doğrulama & Yetki Kontrolü Aktif</span>
          </div>
        </div>
      </div>
    </div>
  );
};
