import * as XLSX from 'xlsx';
import { VehicleRequest, RequestAssignment, Vehicle, Supplier, Facility } from '../types';

export interface ExcelExportFilterOptions {
  dateRange: 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  supplierId: string; // 'ALL' or specific supplierId
  originFacility: string; // 'ALL' or specific facilityName
  destinationFacility: string; // 'ALL' or specific facilityName
  vehicleType: string; // 'ALL' or specific vehicleType ('TIR', 'Kamyon', 'Kamyonet', etc.)
}

export function getDateRangeBounds(dateRange: ExcelExportFilterOptions['dateRange'], customStart?: string, customEnd?: string): { start: string; end: string; label: string } {
  const now = new Date();
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(now);

  if (dateRange === 'TODAY') {
    return { start: todayStr, end: todayStr, label: `Bugün (${todayStr})` };
  }
  if (dateRange === 'LAST_7_DAYS') {
    const past = new Date(now);
    past.setDate(past.getDate() - 6);
    return { start: formatYMD(past), end: todayStr, label: `Son 7 Gün (${formatYMD(past)} - ${todayStr})` };
  }
  if (dateRange === 'LAST_30_DAYS') {
    const past = new Date(now);
    past.setDate(past.getDate() - 29);
    return { start: formatYMD(past), end: todayStr, label: `Son 30 Gün (${formatYMD(past)} - ${todayStr})` };
  }
  if (dateRange === 'THIS_MONTH') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: formatYMD(firstDay), end: todayStr, label: `Bu Ay (${formatYMD(firstDay)} - ${todayStr})` };
  }
  if (dateRange === 'LAST_MONTH') {
    const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: formatYMD(firstDayPrev), end: formatYMD(lastDayPrev), label: `Geçen Ay (${formatYMD(firstDayPrev)} - ${formatYMD(lastDayPrev)})` };
  }
  if (dateRange === 'CUSTOM') {
    const s = customStart || todayStr;
    const e = customEnd || todayStr;
    return { start: s, end: e, label: `Özel Aralık (${s} - ${e})` };
  }

  return { start: todayStr, end: todayStr, label: `Bugün (${todayStr})` };
}

// Helper to auto-fit column widths in SheetJS
function autoFitColumns(rows: any[][]): { wch: number }[] {
  const colWidths: number[] = [];
  rows.forEach((row) => {
    row.forEach((cell, colIndex) => {
      const cellText = cell !== null && cell !== undefined ? String(cell) : '';
      const len = Math.min(Math.max(cellText.length + 3, 10), 45);
      if (!colWidths[colIndex] || len > colWidths[colIndex]) {
        colWidths[colIndex] = len;
      }
    });
  });
  return colWidths.map((wch) => ({ wch }));
}

const isVehicleApproved = (status: string): boolean => {
  return ['APPROVED', 'TEYIT_EDILDI', 'ON_THE_WAY', 'YOLDA', 'ARRIVED', 'TESISE_GIRIS_YAPTI', 'GECIKTI'].includes(status);
};

export function generateAndDownloadKPIExcel(params: {
  filters: ExcelExportFilterOptions;
  requests: VehicleRequest[];
  assignments: RequestAssignment[];
  vehicles: Vehicle[];
  suppliers: Supplier[];
  facilities: Facility[];
}) {
  const { filters, requests, assignments, vehicles, suppliers, facilities } = params;

  const { start, end, label: dateRangeLabel } = getDateRangeBounds(filters.dateRange, filters.startDate, filters.endDate);

  // 1. FILTER REQUESTS
  const filteredRequests = requests.filter((r) => {
    const reqDate = r.requiredDate || (r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split('T')[0] : '');
    if (reqDate && (reqDate < start || reqDate > end)) return false;

    if (filters.originFacility !== 'ALL' && r.originFacility !== filters.originFacility) return false;
    if (filters.destinationFacility !== 'ALL' && r.destination !== filters.destinationFacility) return false;
    if (filters.vehicleType !== 'ALL' && !r.vehicleType.toLowerCase().includes(filters.vehicleType.toLowerCase())) return false;

    if (filters.supplierId !== 'ALL') {
      const hasAssignment = assignments.some(
        (a) => a.requestId === r.id && a.supplierId === filters.supplierId && (a.assignedQuantity > 0 || a.offeredQuantity > 0)
      );
      if (!hasAssignment) return false;
    }

    return true;
  });

  const filteredRequestIds = new Set(filteredRequests.map((r) => r.id));

  // 2. FILTER ASSIGNMENTS
  const filteredAssignments = assignments.filter((a) => {
    if (!filteredRequestIds.has(a.requestId)) return false;
    if (filters.supplierId !== 'ALL' && a.supplierId !== filters.supplierId) return false;
    return true;
  });

  // 3. FILTER VEHICLES
  const filteredVehicles = vehicles.filter((v) => {
    if (!filteredRequestIds.has(v.requestId)) return false;
    if (filters.supplierId !== 'ALL' && v.supplierId !== filters.supplierId) return false;
    if (filters.originFacility !== 'ALL' && v.originFacility !== filters.originFacility) return false;
    if (filters.destinationFacility !== 'ALL' && v.destination !== filters.destinationFacility) return false;
    if (filters.vehicleType !== 'ALL' && !v.vehicleType.toLowerCase().includes(filters.vehicleType.toLowerCase())) return false;
    return true;
  });

  // Helper mapping supplier ID to Name
  const supplierMap = new Map<string, string>();
  suppliers.forEach((s) => supplierMap.set(s.id, s.companyName));
  supplierMap.set('deniz-lojistik', 'Deniz Lojistik');
  supplierMap.set('alp-ozler-lojistik', 'Alp Özler Lojistik');
  supplierMap.set('tekno-lojistik', 'Tekno Lojistik');
  supplierMap.set('ekol-lojistik', 'Ekol Lojistik');

  const getSupplierName = (id: string) => supplierMap.get(id) || id;

  // WORKBOOK
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // SAYFA 1: GENEL KPI ÖZETİ
  // -------------------------------------------------------------
  const totalRequestsCount = filteredRequests.length;
  const totalVehiclesNeeded = filteredRequests.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
  const totalReportedVehicles = filteredVehicles.length;
  const totalApprovedVehicles = filteredVehicles.filter((v) => isVehicleApproved(v.status)).length;
  const totalEnteredFacility = filteredVehicles.filter((v) => v.status === 'TESISE_GIRIS_YAPTI' || v.status === 'ARRIVED').length;
  const totalDelayed = filteredVehicles.filter((v) => v.status === 'GECIKTI').length;
  const remainingVehiclesNeeded = Math.max(0, totalVehiclesNeeded - totalApprovedVehicles);
  const fulfillmentRate = totalVehiclesNeeded > 0 ? ((totalApprovedVehicles / totalVehiclesNeeded) * 100).toFixed(1) : '100.0';
  const onTimeRate = totalApprovedVehicles > 0 ? (((totalApprovedVehicles - totalDelayed) / totalApprovedVehicles) * 100).toFixed(1) : '100.0';

  const sheet1Data: any[][] = [
    ['TEDARİK360 - KURUMSAL LOJİSTİK OPERASYONLARI GENEL KPI RAPORU'],
    ['Rapor Tarih Aralığı:', dateRangeLabel],
    ['Oluşturulma Zamanı:', new Date().toLocaleString('tr-TR')],
    ['Seçili Tedarikçi:', filters.supplierId === 'ALL' ? 'Tüm Tedarikçiler' : getSupplierName(filters.supplierId)],
    ['Seçili Çıkış Tesisi:', filters.originFacility === 'ALL' ? 'Tüm Çıkış Tesisleri' : filters.originFacility],
    ['Seçili Varış Tesisi:', filters.destinationFacility === 'ALL' ? 'Tüm Varış Tesisleri' : filters.destinationFacility],
    ['Seçili Araç Tipi:', filters.vehicleType === 'ALL' ? 'Tüm Araç Tipleri' : filters.vehicleType],
    [],
    ['METRİK / KPI GÖSTERGESİ', 'DEĞER', 'BİRİM / AÇIKLAMA'],
    ['Toplam Talep Sayısı (Adet)', totalRequestsCount, 'Açılan güzergâh talep sayısı'],
    ['Toplam Araç İhtiyacı', totalVehiclesNeeded, 'Talep edilen toplam araç sayısı'],
    ['Bildirilen Araç Sayısı', totalReportedVehicles, 'Tedarikçilerin atadığı / sunduğu araçlar'],
    ['Onaylanan Araç Sayısı', totalApprovedVehicles, 'Operatör/Yönetici tarafından kesinleştirilen'],
    ['Tesise Giriş Yapan Araç Sayısı', totalEnteredFacility, 'Yükleme/boşaltma tesisine giriş yapan'],
    ['Kalan / Eksik Araç İhtiyacı', remainingVehiclesNeeded, 'Halen onay bekleyen açık araç ihtiyacı'],
    ['Geciken Araç Sayısı', totalDelayed, 'Planlanan saate göre gecikmeli giriş yapan'],
    ['Genel Karşılama Oranı', `%${fulfillmentRate}`, 'Onaylanan / Toplam İhtiyaç'],
    ['Zamanında Varış Oranı', `%${onTimeRate}`, 'Zamanında giriş yapan / Onaylanan araç'],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = autoFitColumns(sheet1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'GENEL KPI ÖZETİ');

  // -------------------------------------------------------------
  // SAYFA 2: GÜNLÜK ARAÇ TALEPLERİ
  // -------------------------------------------------------------
  const sheet2Data: any[][] = [
    [
      'TALEP NO',
      'TALEP TARİHİ',
      'PLANLANAN SAAT',
      'ÇIKIŞ TESİSİ',
      'UĞRAKLAR',
      'VARIŞ TESİSİ',
      'ARAÇ TİPİ',
      'İHTİYAÇ (ADET)',
      'BİLDİRİLEN',
      'ONAYLANAN',
      'TESİSE GİRİŞ',
      'KALAN EKSİK',
      'DURUM',
      'DAĞITIM MODU',
      'AÇIKLAMA',
    ],
  ];

  filteredRequests.forEach((req) => {
    const reqVehicles = filteredVehicles.filter((v) => v.requestId === req.id);
    const reported = reqVehicles.length;
    const approved = reqVehicles.filter((v) => isVehicleApproved(v.status)).length;
    const entered = reqVehicles.filter((v) => v.status === 'TESISE_GIRIS_YAPTI' || v.status === 'ARRIVED').length;
    const missing = Math.max(0, (req.totalQuantity || 0) - approved);
    const stopsStr = (req.routeStops || []).map((s) => s.facilityName).join(' -> ') || '-';

    sheet2Data.push([
      req.requestNumber || req.id,
      req.requiredDate || '',
      req.requiredTime || '09:00',
      req.originFacility,
      stopsStr,
      req.destination,
      req.vehicleType,
      req.totalQuantity,
      reported,
      approved,
      entered,
      missing,
      req.status === 'FULFILLED' ? 'Tamamlandı' : req.status === 'PARTIALLY_FULFILLED' ? 'Kısmen Karşılandı' : 'Açık / Beklemede',
      req.distributionMode === 'MANUAL' ? 'Manuel Kota' : 'Açık Talep',
      req.description || '',
    ]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = autoFitColumns(sheet2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'GÜNLÜK ARAÇ TALEPLERİ');

  // -------------------------------------------------------------
  // SAYFA 3: TEDARİKÇİ PERFORMANSI
  // -------------------------------------------------------------
  const sheet3Data: any[][] = [
    [
      'TEDARİKÇİ ADI',
      'ATANAN İHTİYAÇ (KOTA)',
      'BİLDİRİLEN ARAÇ',
      'ONAYLANAN ARAÇ',
      'TESİSE VARAN ARAÇ',
      'EKSİK ARAÇ',
      'GECİKEN ARAÇ',
      'KARŞILAMA ORANI (%)',
      'ZAMANINDA VARIŞ (%)',
      'BAŞARI DURUMU',
    ],
  ];

  const targetSuppliers = filters.supplierId !== 'ALL'
    ? [filters.supplierId]
    : suppliers.map((s) => s.id);

  targetSuppliers.forEach((sId) => {
    const sName = getSupplierName(sId);
    const sAssignments = filteredAssignments.filter((a) => a.supplierId === sId);
    const assignedQty = sAssignments.reduce((sum, a) => sum + (a.assignedQuantity || 0), 0);
    const sVehicles = filteredVehicles.filter((v) => v.supplierId === sId);
    const reportedQty = sVehicles.length;
    const approvedQty = sVehicles.filter((v) => isVehicleApproved(v.status)).length;
    const arrivedQty = sVehicles.filter((v) => v.status === 'TESISE_GIRIS_YAPTI' || v.status === 'ARRIVED').length;
    const delayedQty = sVehicles.filter((v) => v.status === 'GECIKTI').length;
    const missingQty = Math.max(0, assignedQty - approvedQty);
    const rate = assignedQty > 0 ? ((approvedQty / assignedQty) * 100).toFixed(1) : (approvedQty > 0 ? '100.0' : '0.0');
    const onTime = approvedQty > 0 ? (((approvedQty - delayedQty) / approvedQty) * 100).toFixed(1) : '100.0';

    let statusText = 'Mükemmel';
    const numRate = parseFloat(rate);
    if (numRate >= 90) statusText = 'Mükemmel';
    else if (numRate >= 75) statusText = 'İyi';
    else if (numRate >= 60) statusText = 'Kritik';
    else statusText = 'Yetersiz';

    sheet3Data.push([
      sName,
      assignedQty,
      reportedQty,
      approvedQty,
      arrivedQty,
      missingQty,
      delayedQty,
      `%${rate}`,
      `%${onTime}`,
      statusText,
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3['!cols'] = autoFitColumns(sheet3Data);
  XLSX.utils.book_append_sheet(wb, ws3, 'TEDARİKÇİ PERFORMANSI');

  // -------------------------------------------------------------
  // SAYFA 4: TEDARİKÇİ HAT ANALİZİ
  // -------------------------------------------------------------
  const sheet4Data: any[][] = [
    [
      'TEDARİKÇİ',
      'ÇIKIŞ TESİSİ',
      'UĞRAKLAR',
      'VARIŞ TESİSİ',
      'ARAÇ TİPİ',
      'TALEP SAYISI',
      'İHTİYAÇ (ADET)',
      'BİLDİRİLEN',
      'ONAYLANAN',
      'EKSİK ARAÇ',
      'KARŞILAMA ORANI (%)',
      'HAT RİSK SEVİYESİ',
    ],
  ];

  const routeSupplierGroups = new Map<string, {
    supplierId: string;
    origin: string;
    stops: string;
    destination: string;
    vehicleType: string;
    requestCount: number;
    neededQty: number;
    reportedQty: number;
    approvedQty: number;
  }>();

  filteredRequests.forEach((req) => {
    const stopsStr = (req.routeStops || []).map((s) => s.facilityName).join(' -> ') || '-';
    const reqAssignments = filteredAssignments.filter((a) => a.requestId === req.id);

    reqAssignments.forEach((assign) => {
      const key = `${assign.supplierId}|${req.originFacility}|${stopsStr}|${req.destination}|${req.vehicleType}`;
      if (!routeSupplierGroups.has(key)) {
        routeSupplierGroups.set(key, {
          supplierId: assign.supplierId,
          origin: req.originFacility,
          stops: stopsStr,
          destination: req.destination,
          vehicleType: req.vehicleType,
          requestCount: 0,
          neededQty: 0,
          reportedQty: 0,
          approvedQty: 0,
        });
      }
      const entry = routeSupplierGroups.get(key)!;
      entry.requestCount += 1;
      entry.neededQty += assign.assignedQuantity || 0;
    });
  });

  filteredVehicles.forEach((v) => {
    const parentReq = filteredRequests.find((r) => r.id === v.requestId);
    if (!parentReq) return;
    const stopsStr = (parentReq.routeStops || []).map((s) => s.facilityName).join(' -> ') || '-';
    const key = `${v.supplierId}|${v.originFacility}|${stopsStr}|${v.destination}|${v.vehicleType}`;
    if (routeSupplierGroups.has(key)) {
      const entry = routeSupplierGroups.get(key)!;
      entry.reportedQty += 1;
      if (isVehicleApproved(v.status)) {
        entry.approvedQty += 1;
      }
    }
  });

  Array.from(routeSupplierGroups.values()).forEach((grp) => {
    const missing = Math.max(0, grp.neededQty - grp.approvedQty);
    const rate = grp.neededQty > 0 ? ((grp.approvedQty / grp.neededQty) * 100).toFixed(1) : '100.0';
    const numRate = parseFloat(rate);
    let risk = 'DÜŞÜK';
    if (numRate < 50) risk = 'KRİTİK';
    else if (numRate < 75) risk = 'YÜKSEK';
    else if (numRate < 90) risk = 'ORTA';

    sheet4Data.push([
      getSupplierName(grp.supplierId),
      grp.origin,
      grp.stops,
      grp.destination,
      grp.vehicleType,
      grp.requestCount,
      grp.neededQty,
      grp.reportedQty,
      grp.approvedQty,
      missing,
      `%${rate}`,
      risk,
    ]);
  });

  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);
  ws4['!cols'] = autoFitColumns(sheet4Data);
  XLSX.utils.book_append_sheet(wb, ws4, 'TEDARİKÇİ HAT ANALİZİ');

  // -------------------------------------------------------------
  // SAYFA 5: EKSİK ARAÇLAR
  // -------------------------------------------------------------
  const sheet5Data: any[][] = [
    [
      'TALEP NO',
      'TALEP TARİHİ',
      'PLANLANAN SAAT',
      'ÇIKIŞ TESİSİ',
      'UĞRAKLAR',
      'VARIŞ TESİSİ',
      'ARAÇ TİPİ',
      'TOPLAM İHTİYAÇ',
      'ONAYLANAN',
      'KALAN EKSİK ARAÇ',
      'SORUMLU TEDARİKÇİLER',
      'TALEP DURUMU',
    ],
  ];

  filteredRequests.forEach((req) => {
    const reqVehicles = filteredVehicles.filter((v) => v.requestId === req.id);
    const approved = reqVehicles.filter((v) => isVehicleApproved(v.status)).length;
    const missing = Math.max(0, (req.totalQuantity || 0) - approved);

    if (missing > 0) {
      const stopsStr = (req.routeStops || []).map((s) => s.facilityName).join(' -> ') || '-';
      const reqAssigns = filteredAssignments.filter((a) => a.requestId === req.id);
      const supplierNames = reqAssigns.map((a) => `${getSupplierName(a.supplierId)} (${a.assignedQuantity})`).join(', ') || 'Belirtilmedi';

      sheet5Data.push([
        req.requestNumber || req.id,
        req.requiredDate || '',
        req.requiredTime || '09:00',
        req.originFacility,
        stopsStr,
        req.destination,
        req.vehicleType,
        req.totalQuantity,
        approved,
        missing,
        supplierNames,
        req.status === 'PENDING' ? 'Bekliyor' : req.status === 'PARTIALLY_FULFILLED' ? 'Kısmen Karşılandı' : req.status,
      ]);
    }
  });

  const ws5 = XLSX.utils.aoa_to_sheet(sheet5Data);
  ws5['!cols'] = autoFitColumns(sheet5Data);
  XLSX.utils.book_append_sheet(wb, ws5, 'EKSİK ARAÇLAR');

  // -------------------------------------------------------------
  // SAYFA 6: ONAYLANAN ARAÇLAR
  // -------------------------------------------------------------
  const sheet6Data: any[][] = [
    [
      'PLAKA',
      'TEDARİKÇİ',
      'ŞOFÖR ADI',
      'ŞOFÖR TELEFONU',
      'ARAÇ TİPİ',
      'ÇIKIŞ TESİSİ',
      'VARIŞ TESİSİ',
      'İLGİLİ TALEP NO',
      'TARİH',
      'DURUM',
      'ONAY / KAYIT TARİHİ',
    ],
  ];

  filteredVehicles
    .filter((v) => isVehicleApproved(v.status))
    .forEach((v) => {
      const parentReq = filteredRequests.find((r) => r.id === v.requestId);
      const createdDateStr = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString('tr-TR') : '';

      sheet6Data.push([
        v.plate,
        getSupplierName(v.supplierId),
        v.driverName,
        v.driverPhone,
        v.vehicleType,
        v.originFacility,
        v.destination,
        parentReq?.requestNumber || v.requestId,
        v.requiredDate,
        v.status === 'TESISE_GIRIS_YAPTI' ? 'Tesise Giriş Yaptı' : v.status === 'GECIKTI' ? 'Gecikti' : v.status === 'YOLDA' || v.status === 'ON_THE_WAY' ? 'Yolda' : 'Onaylandı',
        createdDateStr,
      ]);
    });

  const ws6 = XLSX.utils.aoa_to_sheet(sheet6Data);
  ws6['!cols'] = autoFitColumns(sheet6Data);
  XLSX.utils.book_append_sheet(wb, ws6, 'ONAYLANAN ARAÇLAR');

  // -------------------------------------------------------------
  // SAYFA 7: GECİKEN ARAÇLAR
  // -------------------------------------------------------------
  const sheet7Data: any[][] = [
    [
      'PLAKA',
      'TEDARİKÇİ',
      'ŞOFÖR ADI',
      'ŞOFÖR TELEFONU',
      'ARAÇ TİPİ',
      'GÜZERGAH',
      'TALEP TARİHİ',
      'PLANLANAN GİRİŞ',
      'GERÇEKLEŞEN GİRİŞ',
      'GECİKME BİLGİSİ',
      'DURUM',
    ],
  ];

  filteredVehicles
    .filter((v) => v.status === 'GECIKTI' || (v.expectedArrival && v.actualArrival && v.actualArrival > v.expectedArrival))
    .forEach((v) => {
      const parentReq = filteredRequests.find((r) => r.id === v.requestId);
      const planTime = v.expectedArrival || parentReq?.requiredTime || '09:00';
      const actualTime = v.actualArrival || 'Giriş Yapılmadı';

      sheet7Data.push([
        v.plate,
        getSupplierName(v.supplierId),
        v.driverName,
        v.driverPhone,
        v.vehicleType,
        `${v.originFacility} -> ${v.destination}`,
        v.requiredDate,
        planTime,
        actualTime,
        'Planlanan saat aşıldı',
        'GECİKTİ',
      ]);
    });

  const ws7 = XLSX.utils.aoa_to_sheet(sheet7Data);
  ws7['!cols'] = autoFitColumns(sheet7Data);
  XLSX.utils.book_append_sheet(wb, ws7, 'GECİKEN ARAÇLAR');

  // -------------------------------------------------------------
  // SAYFA 8: TESİS BAZLI PERFORMANS
  // -------------------------------------------------------------
  const sheet8Data: any[][] = [
    [
      'TESİS ADI',
      'ÇIKIŞ OLARAK TALEP',
      'VARIŞ OLARAK TALEP',
      'TOPLAM ARAÇ İHTİYACI',
      'ONAYLANAN ARAÇ',
      'TESİSE GİRİŞ YAPAN',
      'EKSİK ARAÇ',
      'KARŞILAMA BAŞARI ORANI (%)',
    ],
  ];

  const facilityNames = facilities.length > 0
    ? Array.from(new Set(facilities.map((f) => f.facilityName)))
    : Array.from(new Set([...filteredRequests.map((r) => r.originFacility), ...filteredRequests.map((r) => r.destination)]));

  facilityNames.forEach((facName) => {
    const asOriginReqs = filteredRequests.filter((r) => r.originFacility === facName);
    const asDestReqs = filteredRequests.filter((r) => r.destination === facName);
    const totalFacilityReqs = asOriginReqs.length + asDestReqs.length;

    if (totalFacilityReqs === 0) return;

    const neededQty = asOriginReqs.reduce((sum, r) => sum + (r.totalQuantity || 0), 0);
    const originVehicles = filteredVehicles.filter((v) => v.originFacility === facName);
    const approvedQty = originVehicles.filter((v) => isVehicleApproved(v.status)).length;
    const destVehicles = filteredVehicles.filter((v) => v.destination === facName);
    const enteredQty = destVehicles.filter((v) => v.status === 'TESISE_GIRIS_YAPTI' || v.status === 'ARRIVED').length;
    const missingQty = Math.max(0, neededQty - approvedQty);
    const rate = neededQty > 0 ? ((approvedQty / neededQty) * 100).toFixed(1) : '100.0';

    sheet8Data.push([
      facName,
      asOriginReqs.length,
      asDestReqs.length,
      neededQty,
      approvedQty,
      enteredQty,
      missingQty,
      `%${rate}`,
    ]);
  });

  const ws8 = XLSX.utils.aoa_to_sheet(sheet8Data);
  ws8['!cols'] = autoFitColumns(sheet8Data);
  XLSX.utils.book_append_sheet(wb, ws8, 'TESİS BAZLI PERFORMANS');

  // DOWNLOAD FILE
  const nowStr = new Date().toISOString().split('T')[0];
  const fileName = `Tedarik360_KPI_Raporu_${nowStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
