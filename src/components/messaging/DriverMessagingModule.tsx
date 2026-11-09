import React, { useState, useEffect } from 'react';
import { Message, Vehicle, MessageChannel, RouteStop } from '../../types';
import { sendDriverMessage } from '../../services/logisticsService';
import { useAuth } from '../../context/AuthContext';
import {
  formatPhoneNumber,
  buildWhatsAppWebUrl,
  buildWaMeUrl,
  buildPrimaryWhatsAppUrl,
  buildSmsUrl,
  isMobileDevice,
} from '../../services/phoneUtils';
import {
  MessageSquare,
  Phone,
  AlertCircle,
  Truck,
  X,
  Users,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Info,
  Copy,
  Globe,
  Smartphone,
} from 'lucide-react';

interface MessagingModuleProps {
  messages: Message[];
  vehicles: Vehicle[];
  activeVehicleForModal?: Vehicle | null;
  onCloseModal?: () => void;
}

export interface PresetTemplate {
  id: string;
  title: string;
  renderText: (params: {
    driverName: string;
    plate: string;
    originFacility: string;
    destinationFacility: string;
    routeStops?: RouteStop[];
  }) => string;
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'tpl-eta',
    title: '1. Tahmini Varış Saati',
    renderText: ({ driverName, plate }) =>
      `Merhaba ${driverName}, ${plate} plakalı aracınızın tahmini varış saati nedir?`,
  },
  {
    id: 'tpl-arrival',
    title: '2. Tesise Giriş',
    renderText: ({ driverName }) =>
      `Merhaba ${driverName}, aracınızın tesise giriş yaptığında bize bilgi vermenizi rica ederiz.`,
  },
  {
    id: 'tpl-delay',
    title: '3. Gecikme Bilgisi',
    renderText: ({ driverName }) =>
      `Merhaba ${driverName}, aracınızda herhangi bir gecikme veya problem var mı? Güncel durum bilgisini paylaşabilir misiniz?`,
  },
  {
    id: 'tpl-location',
    title: '4. Konum Bilgisi',
    renderText: ({ driverName }) =>
      `Merhaba ${driverName}, aracınızın mevcut konumunu paylaşabilir misiniz?`,
  },
  {
    id: 'tpl-fault',
    title: '5. Arıza Bildirimi',
    renderText: ({ driverName }) =>
      `Merhaba ${driverName}, aracınızda herhangi bir arıza veya teknik problem bulunuyor mu?`,
  },
  {
    id: 'tpl-stops',
    title: '6. Uğrak Bilgisi',
    renderText: ({ driverName, routeStops }) => {
      const stopNames =
        routeStops && routeStops.length > 0
          ? ` (${routeStops.map((s) => s.facilityName).join(', ')})`
          : '';
      return `Merhaba ${driverName}, sıradaki uğrak noktanıza${stopNames} tahmini varış saatinizi paylaşabilir misiniz?`;
    },
  },
  {
    id: 'tpl-reminder',
    title: '7. Operasyon Hatırlatması',
    renderText: ({ driverName, originFacility, destinationFacility }) =>
      `Merhaba ${driverName}, ${originFacility || 'Çıkış Tesisi'} - ${destinationFacility || 'Varış Tesisi'} güzergâhındaki seferiniz için zamanında hareket etmenizi rica ederiz.`,
  },
];

export const DriverMessagingModule: React.FC<MessagingModuleProps> = ({
  messages,
  vehicles,
  activeVehicleForModal,
  onCloseModal,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(activeVehicleForModal || vehicles[0] || null);
  const [channel, setChannel] = useState<MessageChannel>('WHATSAPP');
  const [customText, setCustomText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // Fallback modal state when link is blocked or manually opened
  const [fallbackModal, setFallbackModal] = useState<{
    isOpen: boolean;
    webUrl: string;
    waMeUrl: string;
    messageText: string;
    driverPhone: string;
    plate: string;
    driverName: string;
  } | null>(null);

  // Bulk Messaging state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [bulkQueueModal, setBulkQueueModal] = useState(false);
  const [bulkProcessedIds, setBulkProcessedIds] = useState<string[]>([]);

  // Update selected vehicle when activeVehicleForModal changes
  useEffect(() => {
    if (activeVehicleForModal) {
      setSelectedVehicle(activeVehicleForModal);
    } else if (!selectedVehicle && vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [activeVehicleForModal, vehicles]);

  // Phone validation for currently selected vehicle
  const phoneValidation = formatPhoneNumber(selectedVehicle?.driverPhone);

  // Messages matching currently selected vehicle
  const currentVehicleMessages = messages.filter((m) => {
    if (!selectedVehicle) return false;
    return (
      m.vehicleId === selectedVehicle.id ||
      (m.plate && m.plate.toUpperCase() === selectedVehicle.plate.toUpperCase()) ||
      (m.driverPhone && m.driverPhone.replace(/\D/g, '') === selectedVehicle.driverPhone.replace(/\D/g, ''))
    );
  });

  // Apply a template to the message area
  const applyTemplate = (template: PresetTemplate, targetVehicle: Vehicle) => {
    setSelectedTemplateId(template.id);
    const populated = template.renderText({
      driverName: targetVehicle.driverName || 'Şoför',
      plate: targetVehicle.plate || '',
      originFacility: targetVehicle.originFacility || '',
      destinationFacility: targetVehicle.destination || '',
      routeStops: targetVehicle.routeStops,
    });
    setCustomText(populated);
    setErrorMessage(null);
  };

  /**
   * Copy message text to clipboard as a reliable fallback
   */
  const handleCopyToClipboard = async (textToCopy: string, customMsg?: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedNotice(customMsg || 'Mesaj metni panoya kopyalandı.');
      setTimeout(() => setCopiedNotice(null), 4000);
    } catch {
      setCopiedNotice('Metin panoya kopyalanamadı.');
      setTimeout(() => setCopiedNotice(null), 3000);
    }
  };

  /**
   * Main Dispatch Handler for WhatsApp and SMS:
   * CRITICAL FIX FOR ERR_BLOCKED_BY_RESPONSE:
   * 1. Direct synchronous click handling: Pre-creates or opens the window immediately on user gesture to avoid popup blockers.
   * 2. Supports Method 1 (WhatsApp Web) & Method 2 (wa.me) to bypass iframe blocking.
   * 3. Provides instant fallback modal + auto clipboard copy if window opening is restricted by browser or iframe.
   * 4. Asynchronous Firestore logging happens in background and does NOT delay or block link opening.
   */
  const handleLaunchMessage = (
    chosenChannel: MessageChannel,
    targetVehicle?: Vehicle,
    specificMethod?: 'web' | 'wame'
  ) => {
    const vehicleToUse = targetVehicle || selectedVehicle;
    if (!currentUser || !vehicleToUse) {
      setErrorMessage('Lütfen önce bir araç ve şoför seçiniz.');
      return;
    }

    const textToSend = customText.trim();
    if (!textToSend) {
      setErrorMessage('Lütfen şoföre iletilecek mesaj metnini yazınız veya bir şablon seçiniz.');
      return;
    }

    const validation = formatPhoneNumber(vehicleToUse.driverPhone);
    if (!validation.isValid) {
      setErrorMessage(
        validation.error ||
          `Şoförün telefon numarası (${vehicleToUse.driverPhone}) geçersiz formatta. Uluslararası WhatsApp veya SMS bağlantısı açılamaz.`
      );
      return;
    }

    setErrorMessage(null);

    // Compute both URLs
    const webUrl = buildWhatsAppWebUrl(validation, textToSend) || '';
    const waMeUrl = buildWaMeUrl(validation, textToSend) || '';
    const smsUrl = buildSmsUrl(validation, textToSend) || '';

    // Choose target URL
    let targetUrl = '';
    let actionStatus: 'WHATSAPP_OPENED' | 'SMS_OPENED' = 'WHATSAPP_OPENED';

    if (chosenChannel === 'WHATSAPP') {
      actionStatus = 'WHATSAPP_OPENED';
      if (specificMethod === 'web') {
        targetUrl = webUrl;
      } else if (specificMethod === 'wame') {
        targetUrl = waMeUrl;
      } else {
        // Default smart selection: desktop -> WhatsApp Web, mobile -> wa.me
        targetUrl = isMobileDevice() ? waMeUrl : webUrl;
      }
    } else {
      actionStatus = 'SMS_OPENED';
      targetUrl = smsUrl;
    }

    if (!targetUrl) {
      setErrorMessage('Mesaj bağlantısı oluşturulamadı. Lütfen telefon numarasını kontrol ediniz.');
      return;
    }

    // SECTION 2: SYNCHRONOUS NEW TAB DISPATCH WITH FALLBACK & AUTO-COPY
    let newTab: Window | null = null;
    let openSucceeded = false;

    if (chosenChannel === 'WHATSAPP') {
      try {
        newTab = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (newTab && !newTab.closed) {
          openSucceeded = true;
        }
      } catch (err) {
        console.warn('Direct window.open caught notice:', err);
      }

      // If blocked or restricted by iframe sandbox: Copy text to clipboard & show fallback options
      if (!openSucceeded) {
        handleCopyToClipboard(textToSend, 'WhatsApp bağlantısı doğrudan açılamadı; mesaj metni panoya kopyalandı.');
        setFallbackModal({
          isOpen: true,
          webUrl,
          waMeUrl,
          messageText: textToSend,
          driverPhone: validation.formattedInternational,
          plate: vehicleToUse.plate,
          driverName: vehicleToUse.driverName,
        });
      } else {
        setInfoNotice(
          `WhatsApp yeni sekmede açıldı (${validation.formattedInternational}). Lütfen açılan sekmede Gönder butonuna basınız. (Tedarik360 üzerinden mesajın fiilen teslim edildiği doğrulanamaz).`
        );
        setTimeout(() => setInfoNotice(null), 8000);
      }
    } else {
      // SMS URI scheme
      try {
        window.location.href = targetUrl;
        setInfoNotice(
          `SMS uygulaması (${validation.formattedSms}) için çağrıldı. Masaüstü cihazlarda SMS desteklenmiyorsa lütfen mobil cihazınızdan veya WhatsApp üzerinden iletiniz.`
        );
        setTimeout(() => setInfoNotice(null), 8000);
      } catch (smsErr: any) {
        handleCopyToClipboard(textToSend, 'SMS uygulaması çağrılamadı; mesaj panoya kopyalandı.');
      }
    }

    // BACKGROUND FIRESTORE LOGGING (Does not block UI or window opening)
    sendDriverMessage({
      vehicleId: vehicleToUse.id,
      driverPhone: validation.formattedInternational,
      driverName: vehicleToUse.driverName,
      plate: vehicleToUse.plate,
      channel: chosenChannel,
      content: textToSend,
      templateId: selectedTemplateId || undefined,
      requestId: vehicleToUse.requestId || undefined,
      actionStatus,
      userUid: currentUser.uid,
      userRole: userProfile?.role || 'OPERATOR',
    }).catch((err) => {
      console.warn('[FIRESTORE NOTICE] Message logging in background:', err.message);
    });
  };

  /**
   * Bulk dispatch handling (Requirement 6)
   * Dispatches messages driver by driver with individual confirmation to prevent duplicate or accidental spam.
   */
  const handleLaunchBulkItem = (v: Vehicle, preferredMethod?: 'web' | 'wame') => {
    if (bulkProcessedIds.includes(v.id)) return;

    const validation = formatPhoneNumber(v.driverPhone);
    if (!validation.isValid) {
      alert(`Hata: ${v.plate} plakalı aracın şoför telefonu (${v.driverPhone}) geçersiz!`);
      return;
    }

    // Replace template parameters if text matches template pattern or use raw text
    let textToSend = customText.trim();
    if (selectedTemplateId) {
      const tpl = PRESET_TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        textToSend = tpl.renderText({
          driverName: v.driverName || 'Şoför',
          plate: v.plate || '',
          originFacility: v.originFacility || '',
          destinationFacility: v.destination || '',
          routeStops: v.routeStops,
        });
      }
    }

    const webUrl = buildWhatsAppWebUrl(validation, textToSend) || '';
    const waMeUrl = buildWaMeUrl(validation, textToSend) || '';
    const smsUrl = buildSmsUrl(validation, textToSend) || '';

    let targetUrl = '';
    let actionStatus: 'WHATSAPP_OPENED' | 'SMS_OPENED' = 'WHATSAPP_OPENED';

    if (channel === 'WHATSAPP') {
      actionStatus = 'WHATSAPP_OPENED';
      if (preferredMethod === 'web') {
        targetUrl = webUrl;
      } else if (preferredMethod === 'wame') {
        targetUrl = waMeUrl;
      } else {
        targetUrl = isMobileDevice() ? waMeUrl : webUrl;
      }
    } else {
      actionStatus = 'SMS_OPENED';
      targetUrl = smsUrl;
    }

    if (!targetUrl) return;

    // Open synchronously
    let openSucceeded = false;
    if (channel === 'WHATSAPP') {
      try {
        const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (win && !win.closed) openSucceeded = true;
      } catch (err) {
        console.warn('Bulk window open warning:', err);
      }

      if (!openSucceeded) {
        handleCopyToClipboard(textToSend, `${v.plate} için mesaj kopyalandı.`);
      }
    } else {
      window.location.href = targetUrl;
    }

    setBulkProcessedIds((prev) => [...prev, v.id]);

    // Background firestore log
    if (currentUser) {
      sendDriverMessage({
        vehicleId: v.id,
        driverPhone: validation.formattedInternational,
        driverName: v.driverName,
        plate: v.plate,
        channel,
        content: textToSend,
        templateId: selectedTemplateId || undefined,
        requestId: v.requestId || undefined,
        actionStatus,
        userUid: currentUser.uid,
        userRole: userProfile?.role || 'OPERATOR',
      }).catch((e) => console.warn('Bulk background log error:', e.message));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col md:flex-row min-h-[640px] text-xs font-sans">
      {/* LEFT COLUMN: Driver & Vehicle Selection List */}
      <div className="w-full md:w-88 border-r border-slate-200/80 flex flex-col bg-slate-50/50">
        <div className="p-4 bg-[#092B60] text-white flex items-center justify-between border-b border-[#0D3978]">
          <div>
            <h3 className="font-black text-[#FFD000] flex items-center gap-2 font-sans">
              <Truck className="w-4 h-4 text-[#FFD000]" />
              Şoför & Araç Listesi
            </h3>
            <span className="text-[11px] text-blue-200">{vehicles.length} Aktif Şoför / Araç</span>
          </div>

          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              setErrorMessage(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all active:scale-98 flex items-center gap-1.5 shadow-2xs ${
              bulkMode
                ? 'bg-[#FFD000] text-[#092B60] border-[#FFD000]'
                : 'bg-[#0D3978] text-white border-blue-400 hover:bg-[#124285]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{bulkMode ? 'Tekil Mod' : 'Toplu Gönderim'}</span>
          </button>
        </div>

        {/* Bulk Selection Bar */}
        {bulkMode && (
          <div className="p-3 bg-[#EAF3FF] border-b border-blue-200 text-[#092B60] text-[11px] font-bold flex items-center justify-between">
            <span>{selectedVehicleIds.length} araç şoförü seçildi</span>
            <button
              onClick={() => {
                if (selectedVehicleIds.length === vehicles.length) {
                  setSelectedVehicleIds([]);
                } else {
                  setSelectedVehicleIds(vehicles.map((v) => v.id));
                }
              }}
              className="text-[#092B60] font-black hover:underline"
            >
              {selectedVehicleIds.length === vehicles.length ? 'Seçimi Temizle' : 'Tümünü Seç'}
            </button>
          </div>
        )}

        {/* Vehicles Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[580px]">
          {vehicles.map((v) => {
            const isSelected = selectedVehicle?.id === v.id;
            const isChecked = selectedVehicleIds.includes(v.id);
            const stops = v.routeStops || [];
            const phoneCheck = formatPhoneNumber(v.driverPhone);

            return (
              <div
                key={v.id}
                onClick={() => {
                  if (bulkMode) {
                    if (isChecked) {
                      setSelectedVehicleIds(selectedVehicleIds.filter((id) => id !== v.id));
                    } else {
                      setSelectedVehicleIds([...selectedVehicleIds, v.id]);
                    }
                  } else {
                    setSelectedVehicle(v);
                    setErrorMessage(null);
                    if (selectedTemplateId) {
                      const tpl = PRESET_TEMPLATES.find((t) => t.id === selectedTemplateId);
                      if (tpl) {
                        applyTemplate(tpl, v);
                      }
                    }
                  }
                }}
                className={`p-3.5 cursor-pointer transition-all flex flex-col gap-1.5 ${
                  !bulkMode && isSelected
                    ? 'bg-[#EAF3FF] border-l-4 border-l-[#092B60]'
                    : 'hover:bg-slate-100/80 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {bulkMode && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-[#092B60] focus:ring-0 w-4 h-4 cursor-pointer mt-0.5"
                      />
                    )}
                    <div>
                      <div className="font-mono font-black text-[#092B60] text-xs flex items-center gap-1.5">
                        <span>{v.plate}</span>
                        <span className="text-[10px] font-normal text-slate-500 font-sans">({v.vehicleType})</span>
                      </div>
                      <div className="text-slate-900 font-bold text-xs">{v.driverName}</div>
                      <div className="text-[11px] font-mono flex items-center gap-1 mt-0.5">
                        <span className={phoneCheck.isValid ? 'text-slate-600' : 'text-rose-600 font-bold'}>
                          {v.driverPhone || 'Telefon Yok'}
                        </span>
                        {!phoneCheck.isValid && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 px-1 rounded font-sans">Hatalı Tel</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="inline-block text-[10px] font-bold text-[#092B60] bg-[#EAF3FF] px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
                    {v.status}
                  </span>
                </div>

                {/* Route detail */}
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 pl-0.5 truncate">
                  <MapPin className="w-3 h-3 text-[#092B60] shrink-0" />
                  <span className="truncate font-semibold text-slate-700">{v.originFacility}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                  <span className="truncate font-semibold text-slate-700">{v.destination}</span>
                  {stops.length > 0 && (
                    <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold shrink-0">
                      +{stops.length} Uğrak
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {vehicles.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              Sistemde şoför veya araç kaydı bulunmuyor.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Real WhatsApp & SMS Composer & Log Feed */}
      <div className="flex-1 flex flex-col justify-between bg-white">
        {/* Selected Driver & Route Banner */}
        <div className="p-4 border-b border-slate-200/80 bg-[#092B60] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {bulkMode ? (
            <div>
              <h2 className="font-black text-[#FFD000] text-sm font-sans flex items-center gap-2">
                <Users className="w-4 h-4 text-[#FFD000]" />
                Toplu Şoför İletişim Paneli
              </h2>
              <p className="text-[11px] text-blue-200 mt-0.5">
                Seçili {selectedVehicleIds.length} şoföre ayrı ayrı bağlantı oluşturulacaktır.
              </p>
            </div>
          ) : selectedVehicle ? (
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FFD000] text-[#092B60] flex items-center justify-center font-black text-base shadow-2xs shrink-0">
                {selectedVehicle.driverName.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-white text-sm flex items-center flex-wrap gap-2">
                  <span>{selectedVehicle.driverName}</span>
                  <span className="font-mono text-xs px-2.5 py-0.5 bg-[#0D3978] rounded-md text-[#FFD000] font-black border border-blue-500/30">
                    {selectedVehicle.plate}
                  </span>
                  <span className="text-xs text-blue-200 font-normal">({selectedVehicle.vehicleType})</span>
                  {selectedVehicle.requestId && (
                    <span className="text-[10px] font-mono bg-blue-900 text-blue-200 px-2 py-0.5 rounded">
                      Talep: {selectedVehicle.requestId}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-blue-200 flex items-center flex-wrap gap-2 mt-1">
                  <span className={`font-mono font-bold ${phoneValidation.isValid ? 'text-[#FFD000]' : 'text-rose-300'}`}>
                    {selectedVehicle.driverPhone}
                  </span>
                  <span>•</span>
                  <span>{selectedVehicle.originFacility} → {selectedVehicle.destination}</span>
                  {selectedVehicle.routeStops && selectedVehicle.routeStops.length > 0 && (
                    <span className="text-[10px] bg-[#FFD000]/20 text-[#FFD000] px-1.5 py-0.2 rounded font-mono">
                      Uğraklar: {selectedVehicle.routeStops.map((s) => s.facilityName).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-blue-200">Lütfen mesaj göndermek için bir şoför seçin.</div>
          )}

          {/* Real Channel Selector */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setChannel('WHATSAPP')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs ${
                channel === 'WHATSAPP'
                  ? 'bg-[#25D366] text-white border border-[#1EBE5D] ring-2 ring-emerald-400/40'
                  : 'bg-[#0D3978] text-emerald-200 hover:text-white border border-blue-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setChannel('SMS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs ${
                channel === 'SMS'
                  ? 'bg-[#0284C7] text-white border border-[#0369A1] ring-2 ring-sky-400/40'
                  : 'bg-[#0D3978] text-sky-200 hover:text-white border border-blue-800'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>SMS</span>
            </button>
          </div>
        </div>

        {/* Notices and Alerts */}
        {errorMessage && (
          <div className="m-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-bold animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {copiedNotice && (
          <div className="m-3 p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2 font-bold animate-in fade-in">
            <Copy className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{copiedNotice}</span>
          </div>
        )}

        {infoNotice && (
          <div className="m-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl text-xs flex items-start gap-2.5 font-bold animate-in fade-in">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span>{infoNotice}</span>
              <div className="text-[10px] text-emerald-700 font-normal">
                Not: WHATSAPP_OPENED / SMS_OPENED durumları mesajın bağlantısının açıldığını gösterir; gerçek iletim WhatsApp / GSM şebekesi tarafından sağlanır.
              </div>
            </div>
          </div>
        )}

        {/* Message Log & Action History Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 max-h-[300px]">
          <div className="text-[11px] font-black text-[#092B60] uppercase tracking-wider flex items-center justify-between border-b border-slate-200 pb-2">
            <span>Mesaj İşlem Geçmişi (Firestore Kayıtları)</span>
            <span className="text-slate-500 font-normal">
              {currentVehicleMessages.length} İşlem
            </span>
          </div>

          {bulkMode ? (
            <div className="p-8 text-center text-slate-500">
              <div className="max-w-md mx-auto">
                <Users className="w-10 h-10 text-[#092B60] mx-auto mb-2 opacity-80" />
                <h4 className="font-black text-[#092B60] text-sm">Toplu Mesaj Gönderim Modu Aktif</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Sol taraftan şoförleri seçin, aşağıdaki hazır şablonlardan birini belirleyip "Toplu Gönderim Önizleme" butonuna basınız. Her şoför için tek tek wa.me veya WhatsApp Web bağlantısı açılacaktır.
                </p>
              </div>
            </div>
          ) : currentVehicleMessages.length > 0 ? (
            currentVehicleMessages.map((msg) => {
              const isOut = msg.direction === 'OUTBOUND';
              const action = msg.actionStatus || (msg.channel === 'WHATSAPP' ? 'WHATSAPP_OPENED' : 'SMS_OPENED');

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl shadow-2xs border ${
                      isOut
                        ? 'bg-[#092B60] text-white border-blue-900 rounded-br-xs'
                        : 'bg-white border-slate-200 text-slate-900 rounded-bl-xs'
                    }`}
                  >
                    <div className="text-xs font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                    <div className="flex items-center justify-between gap-3 mt-2 pt-1.5 border-t border-white/10 text-[10px] font-mono opacity-90">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.2 rounded font-bold ${
                            msg.channel === 'WHATSAPP'
                              ? 'bg-[#25D366] text-white'
                              : 'bg-sky-500 text-white'
                          }`}
                        >
                          {msg.channel}
                        </span>
                        <span className="text-[#FFD000] font-bold">● {action}</span>
                      </div>
                      <span className="opacity-75">
                        {msg.createdAt?.seconds
                          ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Şimdi'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              Bu şoförle henüz kayıtlı mesajlaşma bulunmuyor. Aşağıdaki hazır şablonlardan birini seçebilirsiniz.
            </div>
          )}
        </div>

        {/* PRESET MESSAGE TEMPLATES */}
        <div className="p-3 bg-[#EAF3FF] border-t border-blue-200/80">
          <div className="text-[10px] font-black text-[#092B60] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#092B60]" />
              Hazır Mesaj Şablonları (Otomatik Bilgi Doldurma):
            </span>
            <span className="text-[10px] text-slate-500 font-normal">Düzenlenebilir</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {PRESET_TEMPLATES.map((tpl) => {
              const isSelected = selectedTemplateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    if (selectedVehicle) {
                      applyTemplate(tpl, selectedVehicle);
                    } else {
                      setSelectedTemplateId(tpl.id);
                      setCustomText(tpl.renderText({
                        driverName: '{Şoför}',
                        plate: '{Plaka}',
                        originFacility: '{Çıkış}',
                        destinationFacility: '{Varış}',
                      }));
                    }
                  }}
                  className={`p-2 rounded-xl text-left font-bold text-[11px] transition-all border shadow-2xs truncate ${
                    isSelected
                      ? 'bg-[#092B60] text-[#FFD000] border-[#092B60]'
                      : 'bg-white hover:bg-slate-100 text-[#092B60] border-blue-200'
                  }`}
                  title={tpl.title}
                >
                  <div className="truncate font-black">{tpl.title}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* TEXT COMPOSER & ACTION BUTTONS WITH WHATSAPP WEB & WA.ME & COPY */}
        <div className="p-4 border-t border-slate-200/80 bg-white">
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700">
                Mesaj Metni (Şoföre İletilecek İçerik):
              </label>
              <button
                type="button"
                onClick={() => handleCopyToClipboard(customText, 'Mesaj metni panoya kopyalandı.')}
                disabled={!customText.trim()}
                className="text-[11px] text-[#092B60] hover:underline font-bold flex items-center gap-1 disabled:opacity-40"
              >
                <Copy className="w-3 h-3" />
                <span>Metni Kopyala</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="Mesajınızı buraya yazınız veya yukarıdaki şablonlardan birine tıklayınız..."
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#092B60] bg-slate-50/50"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                WhatsApp Web & wa.me bağlantıları desteklenir. Mesaj doğrudan yeni sekmede açılır.
              </span>
            </div>

            {bulkMode ? (
              <button
                type="button"
                onClick={() => setBulkQueueModal(true)}
                disabled={selectedVehicleIds.length === 0 || !customText.trim()}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-md active:scale-98 shrink-0"
              >
                <Users className="w-4 h-4 text-[#FFD000]" />
                <span>Toplu Gönderim Başlat ({selectedVehicleIds.length} Şoför)</span>
              </button>
            ) : (
              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                {/* PRIMARY WHATSAPP BUTTON (Smart: Desktop -> WhatsApp Web, Mobile -> wa.me) */}
                <button
                  type="button"
                  onClick={() => handleLaunchMessage('WHATSAPP')}
                  disabled={!selectedVehicle || !customText.trim()}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-md active:scale-98 shrink-0"
                  title="WhatsApp'ı yeni sekmede aç"
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                  <span>WhatsApp ile Aç</span>
                  <ExternalLink className="w-3 h-3 text-white/80" />
                </button>

                {/* DIRECT WHATSAPP WEB BUTTON (Method 1) */}
                <button
                  type="button"
                  onClick={() => handleLaunchMessage('WHATSAPP', undefined, 'web')}
                  disabled={!selectedVehicle || !customText.trim()}
                  className="px-3 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-xs text-[11px] shrink-0"
                  title="Masaüstü için web.whatsapp.com bağlantısını doğrudan aç"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Web</span>
                </button>

                {/* DIRECT WA.ME BUTTON (Method 2) */}
                <button
                  type="button"
                  onClick={() => handleLaunchMessage('WHATSAPP', undefined, 'wame')}
                  disabled={!selectedVehicle || !customText.trim()}
                  className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-xs text-[11px] shrink-0"
                  title="Mobil ve uygulama için wa.me bağlantısını aç"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
                  <span>wa.me</span>
                </button>

                {/* SMS BUTTON (Blue) */}
                <button
                  type="button"
                  onClick={() => handleLaunchMessage('SMS')}
                  disabled={!selectedVehicle || !customText.trim()}
                  className="px-4 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-black rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-md active:scale-98 shrink-0"
                  title="sms: URI şeması ile SMS uygulamasını aç"
                >
                  <Phone className="w-4 h-4 text-white" />
                  <span>SMS</span>
                  <ExternalLink className="w-3 h-3 text-white/80" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FALLBACK MODAL (Bypass ERR_BLOCKED_BY_RESPONSE & Iframe Restrictions) */}
      {fallbackModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 text-xs border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#25D366]" />
                WhatsApp İletişim Seçenekleri
              </h3>
              <button
                onClick={() => setFallbackModal(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px]">
              <div className="font-bold flex items-center gap-1.5 mb-0.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Doğrudan Açılma Engellendiğinde Alternatif Bağlantılar:</span>
              </div>
              <p>
                Google AI Studio önizleme penceresi veya tarayıcı güvenlik politikası yeni sekme yönlendirmesini kısıtlamış olabilir. Aşağıdaki butonlarla manuel olarak yeni sekmede açabilir veya kopyalanan mesajı doğrudan WhatsApp'a yapıştırabilirsiniz.
              </p>
            </div>

            <div className="p-3 bg-[#EAF3FF] rounded-xl border border-blue-200 space-y-2">
              <div className="flex items-center justify-between text-[#092B60] font-black">
                <span>{fallbackModal.plate} - {fallbackModal.driverName}</span>
                <span className="font-mono text-slate-600">{fallbackModal.driverPhone}</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-blue-100 font-mono text-[11px] text-slate-800 break-words whitespace-pre-wrap">
                {fallbackModal.messageText}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={fallbackModal.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs no-underline"
              >
                <Globe className="w-4 h-4" />
                <span>Yöntem 1: WhatsApp Web'de Aç (Masaüstü için Tavsiye Edilen)</span>
                <ExternalLink className="w-3 h-3 text-white/80" />
              </a>

              <a
                href={fallbackModal.waMeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs no-underline"
              >
                <Smartphone className="w-4 h-4" />
                <span>Yöntem 2: wa.me ile Aç (Mobil / WhatsApp Uygulaması)</span>
                <ExternalLink className="w-3 h-3 text-white/80" />
              </a>

              <button
                type="button"
                onClick={() => handleCopyToClipboard(fallbackModal.messageText, 'Mesaj panoya kopyalandı!')}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#092B60] font-black rounded-xl flex items-center justify-center gap-2 border border-slate-300"
              >
                <Copy className="w-4 h-4 text-[#092B60]" />
                <span>Mesaj Metnini Tekrar Kopyala</span>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFallbackModal(null)}
                className="px-4 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-bold"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOPLU MESAJ GÖNDERİM MODALI (Requirement 6) */}
      {bulkQueueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 text-xs border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-[#092B60] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#092B60]" />
                Toplu Mesaj Sırası ({channel})
              </h3>
              <button
                onClick={() => setBulkQueueModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-[#EAF3FF] border border-blue-200 rounded-xl text-[#092B60]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-xs">Seçilen Kanal: {channel}</span>
                  <span className="text-[10px] text-slate-500">Mükerrer gönderim engeli devrede</span>
                </div>
                <p className="italic font-medium text-slate-800 bg-white/70 p-2 rounded-lg border border-blue-100">
                  "{customText}"
                </p>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] font-bold">
                ⚠️ Önemli Kural: Her şoför için ayrı bağlantı (WhatsApp Web / SMS) açılır. Her mesajı kontrol edip Gönder butonuna basınız.
              </div>

              <div>
                <span className="font-black text-[#092B60] block mb-1.5">
                  Mesaj Bağlantısı Açılacak Şoförler ({selectedVehicleIds.length} Alıcı):
                </span>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {selectedVehicleIds.map((vId) => {
                    const v = vehicles.find((x) => x.id === vId);
                    if (!v) return null;
                    const phoneCheck = formatPhoneNumber(v.driverPhone);
                    const isProcessed = bulkProcessedIds.includes(v.id);

                    return (
                      <div key={vId} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-[#092B60] font-mono font-black">{v.plate}</strong>
                            <span className="font-bold text-slate-900">{v.driverName}</span>
                          </div>
                          <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                            {phoneCheck.isValid ? phoneCheck.formattedInternational : `Hatalı: ${v.driverPhone}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isProcessed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg font-black text-[10px]">
                              <Check className="w-3 h-3" />
                              Açıldı
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLaunchBulkItem(v, 'web')}
                                disabled={!phoneCheck.isValid}
                                className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-[#25D366] text-white hover:bg-[#1EBE5D] disabled:opacity-40 flex items-center gap-1"
                                title="WhatsApp Web'de Aç"
                              >
                                <span>Web</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLaunchBulkItem(v, 'wame')}
                                disabled={!phoneCheck.isValid}
                                className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40 flex items-center gap-1"
                                title="wa.me'de Aç"
                              >
                                <span>wa.me</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">
                Tamamlanan: {bulkProcessedIds.length} / {selectedVehicleIds.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setBulkQueueModal(false);
                  setBulkProcessedIds([]);
                }}
                className="px-4 py-2 bg-[#092B60] hover:bg-[#0D3978] text-[#FFD000] font-black rounded-xl shadow-xs"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
