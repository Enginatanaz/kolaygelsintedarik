import {
  VehicleRequest,
  RequestAssignment,
  Vehicle,
  VehicleEvent,
  Message,
  AuditLog,
  VehicleStatus,
} from '../types';

const PROJECT_ID = 'funky-decoder-fmn89';

function getSessionToken(): string | null {
  return localStorage.getItem('tedarik360_session_token');
}

// Section 5 Debug Console Logger
function logFirestoreDebug(params: {
  uid: string;
  role: string;
  collection: string;
  operationType: string;
  result: 'SUCCESS' | 'FAILED';
  errorCode?: string;
  errorMessage?: string;
  extra?: Record<string, any>;
}) {
  if (params.result === 'SUCCESS') {
    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: PROJECT_ID,
      uid: params.uid,
      role: params.role,
      claims: { role: params.role },
      collection: params.collection,
      operationType: params.operationType,
      result: 'SUCCESS',
      ...params.extra,
    });
  } else {
    console.error('[DEBUG FIRESTORE OPERATION FAILED]', {
      projectId: PROJECT_ID,
      uid: params.uid,
      role: params.role,
      collection: params.collection,
      operationType: params.operationType,
      result: 'FAILED',
      errorCode: params.errorCode || 'permission-denied',
      errorMessage: params.errorMessage || 'Operation failed',
      ...params.extra,
    });
  }
}

// AUDIT LOG HELPER (Handled server-side, helper kept for backwards compatibility if needed)
export async function createAuditLog(
  actorUid: string,
  actorRole: string,
  action: string,
  collectionName: string,
  documentId: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>
) {
  // Audit logs are created automatically by server API routes
}

import { RouteStop } from '../types';

export interface CreateRequestInput {
  originFacility: string;
  routeStops?: RouteStop[];
  destination: string;
  vehicleType: string;
  totalQuantity: number;
  distributionMode: 'MANUAL' | 'OPEN';
  requiredDate: string;
  requiredTime?: string;
  description?: string;
  manualDistribution?: Record<string, number>;
  selectedSuppliers?: string[];
  createdBy: string;
  userRole: string;
}

// 4. TALEP DAĞITIM MOTORU (MANUEL & AÇIK TALEP) via Server API
export async function createVehicleRequestWithDistribution(input: CreateRequestInput) {
  const token = getSessionToken();
  if (!token) {
    const errorMsg = 'Oturum açılmamış. Lütfen giriş yapınız.';
    logFirestoreDebug({
      uid: input.createdBy,
      role: input.userRole,
      collection: 'vehicleRequests',
      operationType: 'create',
      result: 'FAILED',
      errorCode: 'auth/unauthenticated',
      errorMessage: errorMsg,
    });
    throw new Error(errorMsg);
  }

  try {
    const response = await fetch('/api/requests/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...input,
        sessionToken: token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logFirestoreDebug({
        uid: input.createdBy,
        role: input.userRole,
        collection: 'vehicleRequests',
        operationType: 'create',
        result: 'FAILED',
        errorCode: data.code || 'permission-denied',
        errorMessage: data.error,
      });
      throw new Error(data.error || 'Araç talebi oluşturulamadı.');
    }

    logFirestoreDebug({
      uid: input.createdBy,
      role: input.userRole,
      collection: 'vehicleRequests',
      operationType: 'create',
      result: 'SUCCESS',
      extra: { requestId: data.requestId, requestNumber: data.requestNumber },
    });

    return data.requestId;
  } catch (error: any) {
    if (!error.message.includes('Araç talebi oluşturulamadı')) {
      logFirestoreDebug({
        uid: input.createdBy,
        role: input.userRole,
        collection: 'vehicleRequests',
        operationType: 'create',
        result: 'FAILED',
        errorCode: 'network-error',
        errorMessage: error.message,
      });
    }
    throw error;
  }
}

// TEDARİKÇİ ARAÇ TEKLİFİ / BİLDİRİMİ (OFFER)
export async function submitSupplierOffer(
  assignmentId: string,
  requestId: string,
  supplierId: string,
  offeredQuantity: number,
  responseNote: string,
  userUid: string,
  userRole: string = 'SUPPLIER'
) {
  const token = getSessionToken();
  if (!token) {
    throw new Error('Oturum açılmamış.');
  }

  try {
    const response = await fetch('/api/assignments/offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assignmentId,
        requestId,
        supplierId,
        offeredQuantity,
        responseNote,
        sessionToken: token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      logFirestoreDebug({
        uid: userUid,
        role: userRole,
        collection: 'requestAssignments',
        operationType: 'update',
        result: 'FAILED',
        errorCode: data.code || 'permission-denied',
        errorMessage: data.error,
      });
      throw new Error(data.error || 'Teklif bildirilemedi.');
    }

    logFirestoreDebug({
      uid: userUid,
      role: userRole,
      collection: 'requestAssignments',
      operationType: 'update',
      result: 'SUCCESS',
      extra: { assignmentId, offeredQuantity },
    });
  } catch (error: any) {
    throw error;
  }
}

// YÖNETİCİ ONAY MOTORU (Transaction based: en fazla totalQuantity kadar kesinleştirme)
export async function confirmSupplierQuota(
  requestId: string,
  assignmentId: string,
  confirmedQuantity: number,
  adminUid: string,
  adminRole: string = 'ADMIN'
) {
  const token = getSessionToken();
  if (!token) {
    throw new Error('Oturum açılmamış.');
  }

  try {
    const response = await fetch('/api/assignments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestId,
        assignmentId,
        confirmedQuantity,
        sessionToken: token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      logFirestoreDebug({
        uid: adminUid,
        role: adminRole,
        collection: 'requestAssignments',
        operationType: 'confirm',
        result: 'FAILED',
        errorCode: data.code || 'permission-denied',
        errorMessage: data.error,
      });
      throw new Error(data.error || 'Kontenjan kesinleştirilemedi.');
    }

    logFirestoreDebug({
      uid: adminUid,
      role: adminRole,
      collection: 'requestAssignments',
      operationType: 'confirm',
      result: 'SUCCESS',
      extra: { assignmentId, confirmedQuantity },
    });
  } catch (error: any) {
    throw error;
  }
}

// TEDARİKÇİ VEYA YÖNETİCİ ARAÇ EKLEME
export interface AddVehicleInput {
  requestId: string;
  assignmentId?: string;
  supplierId: string;
  plate: string;
  driverName: string;
  driverPhone: string;
  vehicleType: string;
  originFacility: string;
  routeStops?: RouteStop[];
  destination: string;
  requiredDate: string;
  expectedArrival?: string;
  description?: string;
  userUid: string;
  userRole: string;
}

export async function addVehicle(input: AddVehicleInput) {
  const token = getSessionToken();
  if (!token) {
    throw new Error('Oturum açılmamış.');
  }

  try {
    const response = await fetch('/api/vehicles/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...input,
        sessionToken: token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      logFirestoreDebug({
        uid: input.userUid,
        role: input.userRole,
        collection: 'vehicles',
        operationType: 'create',
        result: 'FAILED',
        errorCode: data.code || 'permission-denied',
        errorMessage: data.error,
      });
      throw new Error(data.error || 'Araç eklenemedi.');
    }

    logFirestoreDebug({
      uid: input.userUid,
      role: input.userRole,
      collection: 'vehicles',
      operationType: 'create',
      result: 'SUCCESS',
      extra: { vehicleId: data.vehicleId },
    });

    return data.vehicleId;
  } catch (error: any) {
    throw error;
  }
}

// ARAÇ REVİZYON SİSTEMİ
export interface ReviseVehicleInput {
  vehicleId: string;
  plate: string;
  driverName: string;
  driverPhone: string;
  expectedArrival?: string;
  requiredDate?: string;
  description?: string;
  userUid: string;
  userRole: string;
}

export async function reviseVehicle(input: ReviseVehicleInput) {
  const token = getSessionToken();
  if (!token) {
    throw new Error('Oturum açılmamış.');
  }

  const response = await fetch('/api/vehicles/revise', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...input,
      sessionToken: token,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    logFirestoreDebug({
      uid: input.userUid,
      role: input.userRole,
      collection: 'vehicles',
      operationType: 'revise',
      result: 'FAILED',
      errorCode: data.code || 'permission-denied',
      errorMessage: data.error,
    });
    throw new Error(data.error || 'Araç revize edilemedi.');
  }

  logFirestoreDebug({
    uid: input.userUid,
    role: input.userRole,
    collection: 'vehicles',
    operationType: 'revise',
    result: 'SUCCESS',
    extra: { vehicleId: input.vehicleId },
  });

  return data.vehicleId;
}

// BİLDİRİM OKUNDU SİMGESİ
export async function markNotificationRead(notificationId: string) {
  try {
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
  } catch (err) {
    console.error('Mark read failed:', err);
  }
}

// ARAÇ DURUM GÜNCELLEME (OPERATOR / ADMIN / SUPPLIER)
export async function updateVehicleStatus(
  vehicleId: string,
  newStatus: VehicleStatus,
  userUid: string,
  userRole: string,
  eventDescription?: string,
  actualArrival?: string
) {
  const token = getSessionToken();
  if (!token) {
    throw new Error('Oturum açılmamış.');
  }

  try {
    const response = await fetch('/api/vehicles/update-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        vehicleId,
        newStatus,
        eventDescription,
        actualArrival,
        sessionToken: token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      logFirestoreDebug({
        uid: userUid,
        role: userRole,
        collection: 'vehicles',
        operationType: 'update',
        result: 'FAILED',
        errorCode: data.code || 'permission-denied',
        errorMessage: data.error,
      });
      throw new Error(data.error || 'Araç durumu güncellenemedi.');
    }

    logFirestoreDebug({
      uid: userUid,
      role: userRole,
      collection: 'vehicles',
      operationType: 'update',
      result: 'SUCCESS',
      extra: { vehicleId, newStatus },
    });
  } catch (error: any) {
    throw error;
  }
}

// ARAÇ BAŞKA TEDARİKÇİYE AKTARMA (ADMIN ONLY)
export async function transferVehicleSupplier(
  vehicleId: string,
  oldSupplierId: string,
  newSupplierId: string,
  adminUid: string,
  adminRole: string = 'ADMIN'
) {
  const token = getSessionToken();
  if (!token) {
    throw new Error('Oturum açılmamış.');
  }

  try {
    const response = await fetch('/api/vehicles/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        vehicleId,
        oldSupplierId,
        newSupplierId,
        sessionToken: token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      logFirestoreDebug({
        uid: adminUid,
        role: adminRole,
        collection: 'vehicles',
        operationType: 'transfer',
        result: 'FAILED',
        errorCode: data.code || 'permission-denied',
        errorMessage: data.error,
      });
      throw new Error(data.error || 'Araç aktarılamadı.');
    }

    logFirestoreDebug({
      uid: adminUid,
      role: adminRole,
      collection: 'vehicles',
      operationType: 'transfer',
      result: 'SUCCESS',
      extra: { vehicleId, oldSupplierId, newSupplierId },
    });
  } catch (error: any) {
    throw error;
  }
}

export interface SendDriverMessageInput {
  vehicleId?: string;
  driverPhone: string;
  driverName?: string;
  plate?: string;
  channel: 'WHATSAPP' | 'SMS';
  content: string;
  templateId?: string;
  requestId?: string;
  actionStatus?: 'DRAFT' | 'WHATSAPP_OPENED' | 'SMS_OPENED' | 'CANCELLED';
  userUid: string;
  userRole: string;
}

export async function sendDriverMessage(input: SendDriverMessageInput) {
  const token = getSessionToken();
  if (!token) {
    throw new Error('Oturum açılmamış.');
  }

  try {
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...input,
        sessionToken: token,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      logFirestoreDebug({
        uid: input.userUid,
        role: input.userRole,
        collection: 'messages',
        operationType: 'create',
        result: 'FAILED',
        errorCode: data.code || 'permission-denied',
        errorMessage: data.error,
      });
      throw new Error(data.error || 'Mesaj gönderilemedi.');
    }

    logFirestoreDebug({
      uid: input.userUid,
      role: input.userRole,
      collection: 'messages',
      operationType: 'create',
      result: 'SUCCESS',
      extra: { messageId: data.messageId },
    });

    return data.messageId;
  } catch (error: any) {
    throw error;
  }
}

// TESİS EKLEME & YÖNETİMİ
export async function addFacility(facilityName: string, city?: string) {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/facilities/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ facilityName, city }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tesis eklenemedi.');
  return data.facility;
}

export async function toggleFacilityActive(facilityId: string, active: boolean) {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/facilities/toggle-active', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ facilityId, active }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tesis durumu güncellenemedi.');
  return data.active;
}

