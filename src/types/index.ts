import { Timestamp } from 'firebase/firestore';

export type UserRole = 'ADMIN' | 'OPERATOR' | 'SUPPLIER';

export interface UserProfile {
  uid: string;
  fullName: string;
  username?: string;
  email: string;
  phone?: string;
  role: UserRole;
  supplierId?: string; // Set when role === 'SUPPLIER'
  active: boolean;
  isActive?: boolean;
  mustChangePassword?: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  pendingEmail?: string;
  verificationCode?: string;
  emailVerified?: boolean;
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  mandatoryCriticalPolicy?: boolean;
  eventPreferences?: NotificationEventPreferences;
  address?: string;
  taxNumber?: string;
  username?: string;
  description?: string;
  active: boolean;
  archived?: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface Facility {
  id: string;
  facilityName: string;
  city: string;
  active: boolean;
  createdAt?: any;
}

export interface RouteStop {
  facilityId: string;
  facilityName: string;
  sequence: number;
  note?: string;
  expectedArrival?: string;
  actualArrival?: string;
  status?: 'BEKLENIYOR' | 'VARDI' | 'TAMAMLANTI';
}

export type DistributionMode = 'MANUAL' | 'OPEN';

export type VehicleRequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED';

export interface VehicleRequest {
  id: string;
  requestNumber: string;
  originFacility: string;
  routeStops?: RouteStop[];
  destination: string;
  vehicleType: string;
  totalQuantity: number;
  distributionMode: DistributionMode;
  requiredDate: string;
  requiredTime?: string;
  description?: string;
  status: VehicleRequestStatus;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}

export type AssignmentStatus =
  | 'PENDING'
  | 'OFFERED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'COMPLETED';

export interface RequestAssignment {
  id: string;
  requestId: string;
  supplierId: string;
  assignedQuantity: number;
  offeredQuantity: number;
  confirmedQuantity: number;
  status: AssignmentStatus;
  responseNote?: string;
  sentAt: any;
  respondedAt?: any;
}

export interface SupplierRequestView {
  id: string;
  requestId: string;
  supplierId: string;
  requestNumber: string;
  originFacility: string;
  routeStops?: RouteStop[];
  destination: string;
  vehicleType: string;
  assignedQuantity: number;
  offeredQuantity?: number;
  confirmedQuantity?: number;
  requiredDate: string;
  requiredTime?: string;
  distributionMode: DistributionMode;
  status: VehicleRequestStatus;
  assignmentStatus?: AssignmentStatus;
  assignmentId?: string;
  responseNote?: string;
  createdAt: any;
}

export type VehicleStatus =
  | 'SUPPLIER_REPORTED'
  | 'REVISION_PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'CANCELLED'
  | 'TALEP_GONDERILDI'
  | 'YANIT_BEKLENIYOR'
  | 'ARAC_BILDIRILDI'
  | 'YONETICI_ONAYI'
  | 'TEYIT_EDILDI'
  | 'YOLDA'
  | 'TESISE_GIRIS_YAPTI'
  | 'GECIKTI'
  | 'ARIZALI'
  | 'IPTAL';

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, { label: string; badgeClass: string }> = {
  SUPPLIER_REPORTED: { label: 'Tedarikçi Bildirdi (Kontrol Bekliyor)', badgeClass: 'bg-[#0D3978] text-white border-[#092B60] font-bold' },
  REVISION_PENDING: { label: 'Revize Edildi (Kontrol Bekliyor)', badgeClass: 'bg-amber-100 text-amber-950 border-amber-400 font-bold' },
  APPROVED: { label: 'Yönetici Onayladı', badgeClass: 'bg-[#A7F36B] text-[#092B60] border-emerald-500 font-black' },
  REJECTED: { label: 'Yönetici Reddetti', badgeClass: 'bg-rose-100 text-rose-950 border-rose-400 font-bold' },
  ON_THE_WAY: { label: 'Yolda', badgeClass: 'bg-sky-100 text-sky-950 border-sky-400 font-bold' },
  ARRIVED: { label: 'Tesise Giriş Yaptı', badgeClass: 'bg-emerald-600 text-white border-emerald-700 font-black' },
  CANCELLED: { label: 'İptal Edildi', badgeClass: 'bg-slate-200 text-slate-700 border-slate-300 font-medium' },

  // Backward compatibility
  TALEP_GONDERILDI: { label: 'Talep Gönderildi', badgeClass: 'bg-[#EAF3FF] text-[#092B60] border-blue-200 font-semibold' },
  YANIT_BEKLENIYOR: { label: 'Yanıt Bekleniyor', badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 font-semibold' },
  ARAC_BILDIRILDI: { label: 'Tedarikçi Bildirdi (Kontrol Bekliyor)', badgeClass: 'bg-[#0D3978] text-white border-[#092B60] font-semibold' },
  YONETICI_ONAYI: { label: 'Yönetici Onayı Bekliyor', badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-200 font-semibold' },
  TEYIT_EDILDI: { label: 'Yönetici Onayladı', badgeClass: 'bg-[#A7F36B]/30 text-emerald-950 border-emerald-400 font-semibold' },
  YOLDA: { label: 'Yolda', badgeClass: 'bg-sky-50 text-sky-900 border-sky-300 font-semibold' },
  TESISE_GIRIS_YAPTI: { label: 'Tesise Giriş Yaptı', badgeClass: 'bg-[#A7F36B] text-[#092B60] border-emerald-500 font-bold' },
  GECIKTI: { label: 'Gecikti', badgeClass: 'bg-amber-200 text-amber-950 border-amber-400 font-bold' },
  ARIZALI: { label: 'Arızalı', badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-bold' },
  IPTAL: { label: 'İptal Edildi', badgeClass: 'bg-slate-200 text-slate-700 border-slate-300 font-medium' },
};

export interface Vehicle {
  id: string;
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
  actualArrival?: string;
  status: VehicleStatus;
  description?: string;
  revisionCount?: number;
  lastRevisionAt?: any;
  lastRevisionBy?: string;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}

export interface VehicleEvent {
  id: string;
  vehicleId: string;
  eventType: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  description: string;
  createdBy: string;
  createdAt: any;
}

export type MessageChannel = 'WHATSAPP' | 'SMS';
export type MessageDirection = 'OUTBOUND' | 'INBOUND';
export type MessageStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RECEIVED';

export type MessageActionStatus =
  | 'DRAFT'
  | 'WHATSAPP_OPENED'
  | 'SMS_OPENED'
  | 'CANCELLED';

export interface MessageLog {
  id: string;
  messageId: string;
  driverId?: string;
  vehicleId?: string;
  plate: string;
  driverName?: string;
  phoneNumber: string;
  requestId?: string;
  channel: MessageChannel;
  messageText: string;
  templateId?: string;
  actionStatus: MessageActionStatus;
  createdBy: string;
  createdAt: any;
}

export interface Message {
  id: string;
  vehicleId?: string;
  driverPhone: string;
  channel: MessageChannel;
  direction: MessageDirection;
  content: string;
  providerMessageId?: string;
  deliveryStatus: MessageStatus;
  actionStatus?: MessageActionStatus;
  templateId?: string;
  requestId?: string;
  sentBy: string;
  createdAt: any;
  driverName?: string;
  plate?: string;
}

export type NotificationEventType =
  | 'NEW_REQUEST'
  | 'REQUEST_REVISION'
  | 'REQUEST_CANCELLED'
  | 'NEW_DEADLINE'
  | 'VEHICLE_APPROVED'
  | 'VEHICLE_REJECTED'
  | 'VEHICLE_REPORTED'
  | 'VEHICLE_REVISED'
  | 'VEHICLE_ARRIVED'
  | 'SYSTEM_ALERT';

export interface NotificationEventPreferences {
  NEW_REQUEST: boolean;
  REQUEST_REVISION: boolean;
  REQUEST_CANCELLED: boolean;
  NEW_DEADLINE: boolean;
  VEHICLE_APPROVED: boolean;
  VEHICLE_REJECTED: boolean;
}

export interface SupplierNotificationSettings {
  id?: string;
  supplierId: string;
  email: string;
  pendingEmail?: string | null;
  verificationCode?: string | null;
  emailVerified: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  mandatoryCriticalPolicy?: boolean;
  eventPreferences: NotificationEventPreferences;
  updatedAt: any;
}

export interface UserDeviceToken {
  id: string;
  userId: string;
  supplierId?: string | null;
  fcmToken: string;
  deviceType: 'ANDROID' | 'IOS_PWA' | 'DESKTOP_WEB' | 'MOBILE_WEB';
  userAgent?: string;
  createdAt: any;
  lastActiveAt: any;
}

export interface NotificationItem {
  id: string;
  notificationId?: string;
  idempotencyKey?: string;
  recipientUserId?: string;
  recipientUid?: string;
  recipientRole?: string;
  supplierId?: string | null;
  requestId?: string;
  relatedRequestId?: string;
  relatedVehicleId?: string;
  type?: NotificationEventType | string;
  title: string;
  body: string;
  message?: string;
  isRead?: boolean;
  read: boolean;
  createdAt: any;
}

export type NotificationChannelType = 'EMAIL' | 'PUSH' | 'IN_APP';
export type NotificationDeliveryStatus =
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'SKIPPED_PREFERENCE'
  | 'SKIPPED_DISABLED'
  | 'SKIPPED_UNVERIFIED_EMAIL';

export interface NotificationLog {
  id: string;
  notificationId: string;
  idempotencyKey: string;
  supplierId?: string | null;
  supplierName?: string;
  requestId?: string | null;
  requestNumber?: string | null;
  eventType: string;
  channel: NotificationChannelType;
  recipient: string;
  status: NotificationDeliveryStatus;
  errorMessage?: string | null;
  emailSubject?: string | null;
  emailHtmlPreview?: string | null;
  retryCount?: number;
  createdAt: any;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorRole: string;
  action: string;
  collection: string;
  documentId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  createdAt: any;
}

export type TemplateRecurrenceType = 'DAILY' | 'WEEKDAYS' | 'WEEKENDS' | 'CUSTOM_DAYS';

export interface DailyRequestTemplate {
  id: string;
  name: string;
  originFacility: string;
  routeStops?: RouteStop[];
  destination: string;
  vehicleType: string;
  defaultQuantity: number;
  requiredTime?: string;
  recurrenceType: TemplateRecurrenceType;
  recurrenceDays?: number[]; // 0: Sunday, 1: Monday, ... 6: Saturday
  startDate?: string;
  endDate?: string;
  distributionMode: 'MANUAL' | 'OPEN';
  supplierIds?: string[];
  manualDistribution?: Record<string, number>;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  description?: string;
  active: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}

export type DraftStatus = 'DRAFT' | 'REVIEWED' | 'CREATED' | 'CANCELLED';

export interface DailyRequestDraft {
  id: string;
  templateId: string;
  templateName: string;
  plannedDate: string; // YYYY-MM-DD
  originFacility: string;
  routeStops?: RouteStop[];
  destination: string;
  vehicleType: string;
  quantity: number;
  requiredTime?: string;
  distributionMode: 'MANUAL' | 'OPEN';
  supplierIds?: string[];
  manualDistribution?: Record<string, number>;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  description?: string;
  status: DraftStatus;
  createdRequestId?: string;
  createdRequestNumber?: string;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}
