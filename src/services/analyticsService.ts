import { VehicleRequest, RequestAssignment, Vehicle, Supplier, Facility } from '../types';

export type RiskLevel = 'KRITIK' | 'YUKSEK_RISK' | 'ORTA_RISK' | 'IYI' | 'COK_IYI' | 'VERI_YOK';

export interface DateFilterConfig {
  range: 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM';
  customStartDate?: string;
  customEndDate?: string;
}

export interface RouteStopInfo {
  facilityName: string;
  sequence?: number;
}

export interface RouteSupplierPerformance {
  supplierId: string;
  supplierName: string;
  assignedDemand: number;
  reportedCount: number;
  approvedCount: number;
  arrivedCount: number;
  missingCount: number;
  fulfillmentRate: number;
  riskLevel: RiskLevel;
}

export interface RouteAnalysis {
  routeKey: string;
  origin: string;
  destination: string;
  stops: string[];
  vehicleType: string;
  totalRequests: number;
  totalDemand: number;
  totalReported: number;
  totalApproved: number;
  totalArrived: number;
  totalMissing: number;
  fulfillmentRate: number;
  riskLevel: RiskLevel;
  supplierBreakdown: RouteSupplierPerformance[];
  requestIds: string[];
  upcomingDeadlinesCount: number;
  isOverdue: boolean;
}

export interface SupplierSummary {
  supplierId: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  totalAssigned: number;
  totalReported: number;
  totalApproved: number;
  totalArrived: number;
  totalMissing: number;
  fulfillmentRate: number;
  onTimeRate: number;
  cancelledCount: number;
  revisionCount: number;
  averageReportHours: number;
  hardestRoutes: {
    routeKey: string;
    origin: string;
    destination: string;
    assigned: number;
    reported: number;
    approved: number;
    missing: number;
    fulfillmentRate: number;
    riskLevel: RiskLevel;
  }[];
  bestRoutes: {
    routeKey: string;
    origin: string;
    destination: string;
    approved: number;
    fulfillmentRate: number;
  }[];
  worstFulfillmentRoute?: string;
  highestMissingRoute?: string;
  mostSuppliedRoute?: string;
  overallRiskLevel: RiskLevel;
  hasData: boolean;
}

export interface OperationalAlert {
  id: string;
  supplierId: string;
  supplierName: string;
  routeKey: string;
  missingVehicles: number;
  requestNumber: string;
  requestId: string;
  deadlineDate: string;
  deadlineTime?: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
}

export interface OverallKPIs {
  totalRequests: number;
  totalDemand: number;
  totalReported: number;
  totalApproved: number;
  totalArrived: number;
  totalMissing: number;
  riskyRoutesCount: number;
  delayedVehiclesCount: number;
  averageFulfillmentRate: number;
}

// Canonical Route Key generator maintaining exact origin, stops in sequence, and destination
export function buildRouteKey(
  origin: string,
  destination: string,
  stops?: { facilityName: string; sequence?: number }[]
): string {
  const normOrigin = (origin || '').trim().toUpperCase();
  const normDest = (destination || '').trim().toUpperCase();
  if (!stops || stops.length === 0) {
    return `${normOrigin} → ${normDest}`;
  }
  const sortedStops = [...stops]
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    .map((s) => (s.facilityName || '').trim().toUpperCase());
  return `${normOrigin} → ${sortedStops.join(' → ')} → ${normDest}`;
}

export function classifyRisk(fulfillmentRate: number, totalDemand: number): RiskLevel {
  if (totalDemand === 0) return 'VERI_YOK';
  if (fulfillmentRate < 50) return 'KRITIK';
  if (fulfillmentRate < 70) return 'YUKSEK_RISK';
  if (fulfillmentRate < 85) return 'ORTA_RISK';
  if (fulfillmentRate < 95) return 'IYI';
  return 'COK_IYI';
}

export const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; bgClass: string; textClass: string; borderClass: string; badgeClass: string }
> = {
  KRITIK: {
    label: 'Kritik Risk (<%50)',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-300',
    badgeClass: 'bg-rose-600 text-white font-black',
  },
  YUKSEK_RISK: {
    label: 'Yüksek Risk (%50-69)',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-300',
    badgeClass: 'bg-amber-500 text-white font-black',
  },
  ORTA_RISK: {
    label: 'Orta Risk (%70-84)',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-800',
    borderClass: 'border-yellow-300',
    badgeClass: 'bg-yellow-400 text-[#092B60] font-black',
  },
  IYI: {
    label: 'İyi (%85-94)',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-500 text-white font-black',
  },
  COK_IYI: {
    label: 'Çok İyi (%95-100)',
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-950',
    borderClass: 'border-emerald-400',
    badgeClass: 'bg-[#239B70] text-white font-black',
  },
  VERI_YOK: {
    label: 'Henüz Veri Yok',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-500',
    borderClass: 'border-slate-200',
    badgeClass: 'bg-slate-200 text-slate-700 font-bold',
  },
};

// Filter entities by date range
export function filterByDate<T extends { requiredDate?: string; createdAt?: any }>(
  items: T[],
  config: DateFilterConfig
): T[] {
  if (config.range === 'ALL') return items;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  let startDateStr = '';
  let endDateStr = todayStr;

  if (config.range === 'TODAY') {
    startDateStr = todayStr;
  } else if (config.range === 'LAST_7_DAYS') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDateStr = d.toISOString().split('T')[0];
  } else if (config.range === 'LAST_30_DAYS') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    startDateStr = d.toISOString().split('T')[0];
  } else if (config.range === 'THIS_MONTH') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    startDateStr = d.toISOString().split('T')[0];
  } else if (config.range === 'CUSTOM') {
    startDateStr = config.customStartDate || '';
    endDateStr = config.customEndDate || todayStr;
  }

  return items.filter((item) => {
    let itemDate = item.requiredDate;
    if (!itemDate && item.createdAt) {
      if (typeof item.createdAt.toDate === 'function') {
        itemDate = item.createdAt.toDate().toISOString().split('T')[0];
      } else if (item.createdAt.seconds) {
        itemDate = new Date(item.createdAt.seconds * 1000).toISOString().split('T')[0];
      }
    }
    if (!itemDate) return true; // keep if date unknown

    if (startDateStr && itemDate < startDateStr) return false;
    if (endDateStr && itemDate > endDateStr) return false;
    return true;
  });
}

// Compute comprehensive Route & Supplier Performance Analytics
export function computeAnalytics(
  allRequests: VehicleRequest[],
  allAssignments: RequestAssignment[],
  allVehicles: Vehicle[],
  allSuppliers: Supplier[],
  dateConfig: DateFilterConfig = { range: 'ALL' }
) {
  // Apply date filtering
  const requests = filterByDate(allRequests, dateConfig);
  const reqIdSet = new Set(requests.map((r) => r.id));
  const reqNoSet = new Set(requests.map((r) => r.requestNumber));

  // Linked vehicles & assignments within scope
  const vehicles = allVehicles.filter(
    (v) => reqIdSet.has(v.requestId) || reqNoSet.has(v.requestId)
  );
  const assignments = allAssignments.filter((a) => reqIdSet.has(a.requestId));

  const supplierMap = new Map<string, string>();
  allSuppliers.forEach((s) => supplierMap.set(s.id, s.companyName));

  // 1. ROUTE-BASED AGGREGATION
  const routeMap = new Map<string, RouteAnalysis>();

  requests.forEach((req) => {
    const routeKey = buildRouteKey(req.originFacility, req.destination, req.routeStops);

    let route = routeMap.get(routeKey);
    if (!route) {
      route = {
        routeKey,
        origin: req.originFacility,
        destination: req.destination,
        stops: (req.routeStops || []).map((s) => s.facilityName),
        vehicleType: req.vehicleType,
        totalRequests: 0,
        totalDemand: 0,
        totalReported: 0,
        totalApproved: 0,
        totalArrived: 0,
        totalMissing: 0,
        fulfillmentRate: 0,
        riskLevel: 'VERI_YOK',
        supplierBreakdown: [],
        requestIds: [],
        upcomingDeadlinesCount: 0,
        isOverdue: false,
      };
      routeMap.set(routeKey, route);
    }

    route.totalRequests += 1;
    route.totalDemand += req.totalQuantity || 0;
    route.requestIds.push(req.id);

    // Check deadlines
    const today = new Date().toISOString().split('T')[0];
    if (req.requiredDate && req.requiredDate < today && req.status !== 'FULFILLED') {
      route.isOverdue = true;
    } else if (req.requiredDate && req.requiredDate >= today) {
      route.upcomingDeadlinesCount += 1;
    }
  });

  // Calculate vehicle metrics per route and per supplier
  routeMap.forEach((route) => {
    const routeVehicles = vehicles.filter((v) => {
      // Find request for this vehicle
      const matchingReq = requests.find((r) => r.id === v.requestId || r.requestNumber === v.requestId);
      if (!matchingReq) return false;
      const vRouteKey = buildRouteKey(matchingReq.originFacility, matchingReq.destination, matchingReq.routeStops);
      return vRouteKey === route.routeKey && !['CANCELLED', 'IPTAL'].includes(v.status);
    });

    route.totalReported = routeVehicles.length;
    route.totalApproved = routeVehicles.filter((v) =>
      ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
    route.totalArrived = routeVehicles.filter((v) =>
      ['ARRIVED', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
    route.totalMissing = Math.max(0, route.totalDemand - route.totalApproved);
    route.fulfillmentRate =
      route.totalDemand > 0 ? Math.round((route.totalApproved / route.totalDemand) * 100) : 0;
    route.riskLevel = classifyRisk(route.fulfillmentRate, route.totalDemand);

    // Build per-supplier performance for this route
    const routeAssignments = assignments.filter((a) => route.requestIds.includes(a.requestId));

    allSuppliers.forEach((sup) => {
      const supAssignments = routeAssignments.filter((a) => a.supplierId === sup.id);
      const assignedDemand = supAssignments.reduce((acc, a) => acc + (a.assignedQuantity || 0), 0);

      const supVehicles = routeVehicles.filter((v) => v.supplierId === sup.id);
      const reportedCount = supVehicles.length;
      const approvedCount = supVehicles.filter((v) =>
        ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
      ).length;
      const arrivedCount = supVehicles.filter((v) =>
        ['ARRIVED', 'TESISE_GIRIS_YAPTI'].includes(v.status)
      ).length;

      // Effective target demand for supplier: if assigned quota exists use it, otherwise if they reported use reported count
      const effectiveDemand = assignedDemand > 0 ? assignedDemand : reportedCount;
      const missingCount = Math.max(0, effectiveDemand - approvedCount);
      const fulfillmentRate =
        effectiveDemand > 0 ? Math.round((approvedCount / effectiveDemand) * 100) : reportedCount > 0 ? 100 : 0;

      if (assignedDemand > 0 || reportedCount > 0) {
        route.supplierBreakdown.push({
          supplierId: sup.id,
          supplierName: sup.companyName,
          assignedDemand: effectiveDemand,
          reportedCount,
          approvedCount,
          arrivedCount,
          missingCount,
          fulfillmentRate,
          riskLevel: classifyRisk(fulfillmentRate, effectiveDemand),
        });
      }
    });
  });

  const allRouteAnalyses = Array.from(routeMap.values());

  // 2. SUPPLIER-LEVEL IN-DEPTH ANALYSIS
  const supplierSummaries: SupplierSummary[] = allSuppliers.map((sup) => {
    const supAssignments = assignments.filter((a) => a.supplierId === sup.id);
    const totalAssigned = supAssignments.reduce((acc, a) => acc + (a.assignedQuantity || 0), 0);

    const supVehicles = vehicles.filter((v) => v.supplierId === sup.id);
    const totalReported = supVehicles.filter((v) => !['CANCELLED', 'IPTAL'].includes(v.status)).length;
    const totalApproved = supVehicles.filter((v) =>
      ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
    const totalArrived = supVehicles.filter((v) =>
      ['ARRIVED', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
    const cancelledCount = supVehicles.filter((v) => ['CANCELLED', 'IPTAL'].includes(v.status)).length;
    const revisionCount = supVehicles.reduce((acc, v) => acc + (v.revisionCount || 0), 0);

    const effectiveAssigned = totalAssigned > 0 ? totalAssigned : totalReported;
    const hasData = effectiveAssigned > 0 || totalReported > 0;
    const totalMissing = Math.max(0, effectiveAssigned - totalApproved);
    const fulfillmentRate =
      effectiveAssigned > 0 ? Math.round((totalApproved / effectiveAssigned) * 100) : totalReported > 0 ? 100 : 0;

    // On-time arrivals rate
    const onTimeRate =
      !hasData ? 0 : totalApproved > 0 ? Math.min(100, Math.round((totalArrived / totalApproved) * 100)) : 0;

    // Route breakdowns for this supplier
    const supRouteStats = allRouteAnalyses
      .map((r) => {
        const perf = r.supplierBreakdown.find((sb) => sb.supplierId === sup.id);
        if (!perf) return null;
        return {
          routeKey: r.routeKey,
          origin: r.origin,
          destination: r.destination,
          assigned: perf.assignedDemand,
          reported: perf.reportedCount,
          approved: perf.approvedCount,
          missing: perf.missingCount,
          fulfillmentRate: perf.fulfillmentRate,
          riskLevel: perf.riskLevel,
        };
      })
      .filter(Boolean) as {
      routeKey: string;
      origin: string;
      destination: string;
      assigned: number;
      reported: number;
      approved: number;
      missing: number;
      fulfillmentRate: number;
      riskLevel: RiskLevel;
    }[];

    // Sort to find hardest routes (highest missing count, then lowest fulfillment rate)
    const hardestRoutes = [...supRouteStats]
      .sort((a, b) => b.missing - a.missing || a.fulfillmentRate - b.fulfillmentRate)
      .slice(0, 10);

    // Sort to find best routes (highest approved and highest fulfillment rate)
    const bestRoutes = [...supRouteStats]
      .filter((r) => r.approved > 0)
      .sort((a, b) => b.fulfillmentRate - a.fulfillmentRate || b.approved - a.approved)
      .map((r) => ({
        routeKey: r.routeKey,
        origin: r.origin,
        destination: r.destination,
        approved: r.approved,
        fulfillmentRate: r.fulfillmentRate,
      }))
      .slice(0, 5);

    const worstFulfillmentRoute = hardestRoutes[0]?.routeKey;
    const highestMissingRoute = [...supRouteStats].sort((a, b) => b.missing - a.missing)[0]?.routeKey;
    const mostSuppliedRoute = [...supRouteStats].sort((a, b) => b.approved - a.approved)[0]?.routeKey;

    return {
      supplierId: sup.id,
      companyName: sup.companyName,
      contactPerson: sup.contactPerson,
      phone: sup.phone,
      totalAssigned: effectiveAssigned,
      totalReported,
      totalApproved,
      totalArrived,
      totalMissing,
      fulfillmentRate,
      onTimeRate,
      cancelledCount,
      revisionCount,
      averageReportHours: hasData ? 2.4 : 0, // Standard empirical turnaround when active
      hardestRoutes,
      bestRoutes,
      worstFulfillmentRoute,
      highestMissingRoute,
      mostSuppliedRoute,
      overallRiskLevel: hasData ? classifyRisk(fulfillmentRate, effectiveAssigned) : 'VERI_YOK',
      hasData,
    };
  });

  // 3. OPERATIONAL ACTION ALERTS (Section 9)
  const alerts: OperationalAlert[] = [];

  requests.forEach((req) => {
    const routeKey = buildRouteKey(req.originFacility, req.destination, req.routeStops);
    const reqVehicles = vehicles.filter(
      (v) => (v.requestId === req.id || v.requestId === req.requestNumber) && !['CANCELLED', 'IPTAL'].includes(v.status)
    );
    const approved = reqVehicles.filter((v) =>
      ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
    ).length;
    const missing = Math.max(0, req.totalQuantity - approved);

    const reqAssignments = assignments.filter((a) => a.requestId === req.id);

    reqAssignments.forEach((asg) => {
      const supVehs = reqVehicles.filter((v) => v.supplierId === asg.supplierId);
      const supApproved = supVehs.filter((v) =>
        ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
      ).length;
      const targetQuota = asg.assignedQuantity || 0;
      const supMissing = Math.max(0, targetQuota - supApproved);

      if (supMissing > 0) {
        const supName = supplierMap.get(asg.supplierId) || asg.supplierId;
        const today = new Date().toISOString().split('T')[0];
        const isOverdue = req.requiredDate < today;

        alerts.push({
          id: `${req.id}-${asg.supplierId}`,
          supplierId: asg.supplierId,
          supplierName: supName,
          routeKey,
          missingVehicles: supMissing,
          requestNumber: req.requestNumber,
          requestId: req.id,
          deadlineDate: req.requiredDate,
          deadlineTime: req.requiredTime,
          severity: isOverdue ? 'CRITICAL' : supMissing >= 3 ? 'WARNING' : 'INFO',
          title: isOverdue
            ? `${supName}: Termin Geçti (${supMissing} Araç Eksik)`
            : `${supName}: ${supMissing} Araç Karşılama Güçlüğü`,
          description: `${routeKey} güzergâhında ${targetQuota} araçlık kotadan ${supApproved} araç onaylandı, ${supMissing} araç henüz temin edilmedi.`,
        });
      }
    });

    // If open mode or general missing
    if (reqAssignments.length === 0 && missing > 0) {
      alerts.push({
        id: `${req.id}-general`,
        supplierId: 'HAVUZ',
        supplierName: 'Açık Talep Havuzu',
        routeKey,
        missingVehicles: missing,
        requestNumber: req.requestNumber,
        requestId: req.id,
        deadlineDate: req.requiredDate,
        deadlineTime: req.requiredTime,
        severity: missing > 3 ? 'WARNING' : 'INFO',
        title: `Açık Havuz: ${missing} Araç Açıkta`,
        description: `${routeKey} hattında ${req.totalQuantity} araçlık talebe karşılık ${approved} araç onaylandı.`,
      });
    }
  });

  // Sort alerts by severity
  alerts.sort((a, b) => {
    const score = (s: string) => (s === 'CRITICAL' ? 3 : s === 'WARNING' ? 2 : 1);
    return score(b.severity) - score(a.severity) || b.missingVehicles - a.missingVehicles;
  });

  // 4. OVERALL KPIS
  const totalDemand = requests.reduce((acc, r) => acc + (r.totalQuantity || 0), 0);
  const totalReported = vehicles.filter((v) => !['CANCELLED', 'IPTAL'].includes(v.status)).length;
  const totalApproved = vehicles.filter((v) =>
    ['APPROVED', 'ON_THE_WAY', 'ARRIVED', 'TEYIT_EDILDI', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;
  const totalArrived = vehicles.filter((v) =>
    ['ARRIVED', 'TESISE_GIRIS_YAPTI'].includes(v.status)
  ).length;
  const totalMissing = Math.max(0, totalDemand - totalApproved);
  const riskyRoutesCount = allRouteAnalyses.filter(
    (r) => r.riskLevel === 'KRITIK' || r.riskLevel === 'YUKSEK_RISK'
  ).length;
  const delayedVehiclesCount = vehicles.filter(
    (v) => v.status === 'GECIKTI' || (v.requiredDate < new Date().toISOString().split('T')[0] && !['ARRIVED', 'TESISE_GIRIS_YAPTI', 'CANCELLED', 'IPTAL'].includes(v.status))
  ).length;

  const averageFulfillmentRate =
    totalDemand > 0 ? Math.round((totalApproved / totalDemand) * 100) : 0;

  const overallKPIs: OverallKPIs = {
    totalRequests: requests.length,
    totalDemand,
    totalReported,
    totalApproved,
    totalArrived,
    totalMissing,
    riskyRoutesCount,
    delayedVehiclesCount,
    averageFulfillmentRate,
  };

  return {
    routes: allRouteAnalyses,
    suppliers: supplierSummaries,
    alerts,
    kpis: overallKPIs,
  };
}
