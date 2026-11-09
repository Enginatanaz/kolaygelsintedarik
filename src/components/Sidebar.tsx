import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FileSpreadsheet,
  PlusCircle,
  Truck,
  Building2,
  Users,
  MessageSquare,
  Calendar,
  BarChart3,
  Bell,
  History,
  Settings,
  Clock,
  AlertTriangle,
  Send,
  CheckCircle2,
  ShieldCheck,
  Radio,
  MapPin,
  FileText,
  CalendarClock,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { userProfile } = useAuth();
  const role = userProfile?.role;

  // YÖNETİCİ MENÜSÜ
  const adminMenuItems = [
    { id: 'admin-overview', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'admin-requests', label: 'Araç Talepleri', icon: FileSpreadsheet },
    ...(role === 'ADMIN' ? [{ id: 'admin-templates', label: 'Günlük Talep Şablonları', icon: CalendarClock }] : []),
    { id: 'admin-vehicles', label: 'Araç Yönetimi', icon: Truck },
    { id: 'admin-suppliers', label: 'Tedarikçi Yönetimi', icon: Building2 },
    { id: 'admin-supplier-performance', label: 'Tedarikçi Performans ve Hat Analizi', icon: BarChart3 },
    { id: 'admin-facilities', label: 'Tesis Yönetimi', icon: MapPin },
    { id: 'admin-operators', label: 'Operasyon Yönetimi', icon: Users },
    { id: 'admin-messages', label: 'Şoför Mesajları', icon: MessageSquare },
    { id: 'admin-notifications', label: 'Bildirimler', icon: Bell },
    { id: 'admin-reports', label: 'Raporlar', icon: FileText },
    ...(role === 'ADMIN' ? [{ id: 'admin-settings', label: 'Sistem Ayarları', icon: Settings }] : []),
  ];

  // OPERATÖR MENÜSÜ
  const operatorMenuItems = [
    { id: 'op-daily', label: 'Günlük Operasyon', icon: LayoutDashboard },
    { id: 'op-all-vehicles', label: 'Tüm Araçlar & Uğraklar', icon: Truck },
    { id: 'op-on-road', label: 'Yolda Olan Araçlar', icon: Clock },
    { id: 'op-arrived', label: 'Tesise Giriş Yapanlar', icon: CheckCircle2 },
    { id: 'op-delayed', label: 'Geciken Araçlar', icon: AlertTriangle },
    { id: 'op-broken', label: 'Arızalı Araçlar', icon: AlertTriangle },
    { id: 'op-messages', label: 'Şoför Mesajları', icon: MessageSquare },
    { id: 'op-notifications', label: 'Bildirim Merkezi', icon: Bell },
    { id: 'op-history', label: 'Operasyon Geçmişi', icon: History },
  ];

  // TEDARİKÇİ MENÜSÜ
  const supplierMenuItems = [
    { id: 'sup-overview', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'sup-requests', label: 'Atanmış Taleplerim', icon: FileSpreadsheet },
    { id: 'sup-pending', label: 'Yanıt Bekleyen Talepler', icon: Clock },
    { id: 'sup-fulfilled', label: 'Karşılanan Araçlarım', icon: CheckCircle2 },
    { id: 'sup-vehicles', label: 'Bildirdiğim Araçlar', icon: Truck },
    { id: 'sup-new-vehicle', label: 'Yeni Araç Bildir', icon: PlusCircle },
    { id: 'sup-notifications', label: 'Bildirimler & Tercihler', icon: Bell },
    { id: 'sup-performance', label: 'Performansım', icon: BarChart3 },
  ];

  let items = adminMenuItems;
  let sectionLabel = 'YÖNETİCİ PANELİ';

  if (role === 'OPERATOR') {
    items = operatorMenuItems;
    sectionLabel = 'OPERATÖR PANELİ';
  } else if (role === 'SUPPLIER') {
    items = supplierMenuItems;
    sectionLabel = 'TEDARİKÇİ PANELİ';
  }

  return (
    <aside className="w-64 bg-[#092B60] text-slate-200 flex flex-col shrink-0 border-r border-[#0D3978]/80 select-none">
      <div className="p-4 border-b border-[#0D3978]/60 bg-[#092B60]">
        <div className="flex items-center gap-2 mb-1">
          {role === 'ADMIN' && <ShieldCheck className="w-4 h-4 text-[#FFD000]" />}
          {role === 'OPERATOR' && <Radio className="w-4 h-4 text-[#FFD000]" />}
          {role === 'SUPPLIER' && <Building2 className="w-4 h-4 text-[#FFD000]" />}
          <span className="text-[11px] font-black tracking-wider text-[#FFD000] uppercase font-sans">
            {sectionLabel}
          </span>
        </div>
        {role === 'SUPPLIER' && (
          <div className="text-xs font-black text-white truncate mt-0.5 bg-[#0D3978]/80 px-2.5 py-1 rounded-lg border border-blue-700/40">
            {userProfile?.fullName || userProfile?.supplierId || 'Tedarikçi Portalı'}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left relative ${
                isActive
                  ? 'bg-[#0D3978] text-[#FFD000] shadow-sm font-black'
                  : 'text-slate-200 hover:bg-[#0D3978]/50 hover:text-white'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#FFD000] rounded-r-full" />
              )}
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#FFD000]' : 'text-blue-300'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#0D3978]/60 text-[11px] text-blue-200 bg-[#0D3978]/30">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-white tracking-tight">TEDARİK360 v2.5</span>
          <span className="text-[10px] bg-[#A7F36B]/20 text-[#A7F36B] border border-[#A7F36B]/40 px-2 py-0.5 rounded-full font-bold">
            Canlı Engine
          </span>
        </div>
        <p className="text-[10px] text-slate-300">Gizlilik & RBAC Güvenlik Sistemi Aktif</p>
      </div>
    </aside>
  );
};

