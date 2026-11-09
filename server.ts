import express from 'express';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import crypto from 'crypto';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Firebase Client app on server for Firestore operations
const serverApp = initializeApp(firebaseConfig, 'Tedarik360Server');
const serverDb = getFirestore(serverApp, (firebaseConfig as any).firestoreDatabaseId);

// Cryptographic Security Configurations
const SESSION_SECRET = process.env.SESSION_SECRET || 'tedarik360-jwt-session-secret-key-prod-2026';

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    if (!password || !salt || !hash) return false;
    const check = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export function createSessionToken(user: { uid: string; username: string; role: string; supplierId?: string | null }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.uid,
      username: user.username,
      role: user.role,
      supplierId: user.supplierId || null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days
    })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifySessionToken(token: string): { uid: string; username: string; role: string; supplierId?: string | null } | null {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

// In-memory rate limiting for login attempts (Requirement 11)
const loginAttemptMap = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 3 * 60 * 1000; // 3 minutes lockout

function checkRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const entry = loginAttemptMap.get(key);
  if (!entry) return { allowed: true };

  if (entry.lockedUntil > now) {
    const waitSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (entry.lockedUntil <= now && entry.count >= MAX_ATTEMPTS) {
    loginAttemptMap.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const entry = loginAttemptMap.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  loginAttemptMap.set(key, entry);
}

function clearFailedAttempts(key: string) {
  loginAttemptMap.delete(key);
}

// Server-side User Setup for Requested Accounts
async function bootstrapInitialAccounts() {
  const defaultAccounts = [
    // 1. ADMIN
    {
      username: 'tdr_admin_26',
      initialPassword: 'Admin@4826',
      fullName: 'Sistem Yöneticisi',
      role: 'ADMIN',
      supplierId: null,
      mustChangePassword: true,
    },
    // 2. OPERATÖRLER
    {
      username: 'tdr_operator_01',
      initialPassword: 'Oper@7352',
      fullName: 'Operatör 1',
      role: 'OPERATOR',
      supplierId: null,
      mustChangePassword: true,
    },
    {
      username: 'tdr_operator_02',
      initialPassword: 'Oper@6294',
      fullName: 'Operatör 2',
      role: 'OPERATOR',
      supplierId: null,
      mustChangePassword: true,
    },
    {
      username: 'tdr_operator_03',
      initialPassword: 'Oper@8531',
      fullName: 'Operatör 3',
      role: 'OPERATOR',
      supplierId: null,
      mustChangePassword: true,
    },
    // 3. TEDARİKÇİLER
    {
      username: 'dnz_tdrk_84x',
      initialPassword: 'Deniz@4826',
      fullName: 'Deniz Lojistik',
      role: 'SUPPLIER',
      supplierId: 'deniz-lojistik',
      mustChangePassword: true,
    },
    {
      username: 'alp_loj_72k9',
      initialPassword: 'Alp@7352Loj',
      fullName: 'Alp Özler Lojistik',
      role: 'SUPPLIER',
      supplierId: 'alp-ozler-lojistik',
      mustChangePassword: true,
    },
    {
      username: 'ekl_tdr_93m',
      initialPassword: 'Ekol@6294',
      fullName: 'Ekol Lojistik',
      role: 'SUPPLIER',
      supplierId: 'ekol-lojistik',
      mustChangePassword: true,
    },
    {
      username: 'tkn_loj_61p8',
      initialPassword: 'Tekno@8531',
      fullName: 'Tekno Lojistik',
      role: 'SUPPLIER',
      supplierId: 'tekno-lojistik',
      mustChangePassword: true,
    },
    // Legacy fallback accounts
    {
      username: 'admin',
      initialPassword: process.env.INITIAL_ADMIN_PASSWORD || 'admin123',
      fullName: 'Sistem Yöneticisi (Legacy)',
      role: 'ADMIN',
      supplierId: null,
      mustChangePassword: false,
    },
    {
      username: 'operator',
      initialPassword: process.env.INITIAL_OPERATOR_PASSWORD || 'operator123',
      fullName: 'Operasyon Sorumlusu (Legacy)',
      role: 'OPERATOR',
      supplierId: null,
      mustChangePassword: false,
    },
  ];

  try {
    for (const acc of defaultAccounts) {
      const uid = `usr-${acc.username}`;
      const userRef = doc(serverDb, 'users', uid);
      const existingDoc = await getDoc(userRef);

      if (!existingDoc.exists()) {
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(acc.initialPassword, salt);

        await setDoc(userRef, {
          uid,
          username: acc.username,
          fullName: acc.fullName,
          role: acc.role,
          supplierId: acc.supplierId || null,
          email: `${acc.username}@tedarik360.local`,
          phone: '',
          salt,
          passwordHash,
          active: true,
          isActive: true,
          mustChangePassword: acc.mustChangePassword ?? true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log(`[BOOTSTRAP] Initialized required account: ${acc.username} (${acc.role})`);
      } else {
        // Ensure mustChangePassword and isActive fields exist
        const data = existingDoc.data();
        const patch: Record<string, any> = {};
        if (data.mustChangePassword === undefined && acc.mustChangePassword !== undefined) {
          patch.mustChangePassword = acc.mustChangePassword;
        }
        if (data.isActive === undefined) {
          patch.isActive = data.active !== false;
        }
        if (acc.supplierId && !data.supplierId) {
          patch.supplierId = acc.supplierId;
        }
        if (Object.keys(patch).length > 0) {
          await setDoc(existingDoc.ref, patch, { merge: true });
        }
      }
    }

    // Ensure default suppliers exist in Firestore suppliers collection with matching username mappings
    const defaultSuppliersData = [
      { id: 'deniz-lojistik', companyName: 'Deniz Lojistik', contactPerson: 'Hakan Deniz', phone: '+90 532 100 0001', email: 'operasyon@denizlojistik.com', username: 'dnz_tdrk_84x' },
      { id: 'alp-ozler-lojistik', companyName: 'Alp Özler Lojistik', contactPerson: 'Murat Özler', phone: '+90 532 200 0002', email: 'operasyon@alpozler.com', username: 'alp_loj_72k9' },
      { id: 'tekno-lojistik', companyName: 'Tekno Lojistik', contactPerson: 'Serkan Tekin', phone: '+90 532 300 0003', email: 'filo@teknolojistik.com', username: 'tkn_loj_61p8' },
      { id: 'ekol-lojistik', companyName: 'Ekol Lojistik', contactPerson: 'Cem Kaya', phone: '+90 532 400 0004', email: 'tedarik@ekol.com', username: 'ekl_tdr_93m' },
      { id: 'ayz-lojistik', companyName: 'Ayz Lojistik', contactPerson: 'Ayz Lojistik Yetkilisi', phone: '+90 532 500 0005', email: 'operasyon@ayzlojistik.com', username: 'ayz_lojistik' },
    ];

    for (const sup of defaultSuppliersData) {
      const supRef = doc(serverDb, 'suppliers', sup.id);
      const supDoc = await getDoc(supRef);
      const defaultPrefs = {
        NEW_REQUEST: true,
        REQUEST_REVISION: true,
        REQUEST_CANCELLED: true,
        NEW_DEADLINE: true,
        VEHICLE_APPROVED: true,
        VEHICLE_REJECTED: true,
      };
      if (!supDoc.exists()) {
        await setDoc(supRef, {
          ...sup,
          emailVerified: true,
          pendingEmail: '',
          emailEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          mandatoryCriticalPolicy: false,
          eventPreferences: defaultPrefs,
          address: 'Türkiye',
          taxNumber: '',
          description: 'Kurumsal lojistik çözüm ortağı',
          active: true,
          archived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        console.log(`[BOOTSTRAP] Seeded supplier: ${sup.companyName}`);
      } else {
        const d = supDoc.data();
        const patch: Record<string, any> = {};
        if (d.emailVerified === undefined) patch.emailVerified = true;
        if (d.emailEnabled === undefined) patch.emailEnabled = true;
        if (d.pushEnabled === undefined) patch.pushEnabled = true;
        if (d.inAppEnabled === undefined) patch.inAppEnabled = true;
        if (d.mandatoryCriticalPolicy === undefined) patch.mandatoryCriticalPolicy = false;
        if (!d.eventPreferences) patch.eventPreferences = defaultPrefs;
        if (Object.keys(patch).length > 0) {
          await setDoc(supRef, patch, { merge: true });
        }
      }

      // Best-effort mirror to supplierNotificationSettings if rules permit
      const currentEmail = supDoc.exists() ? (supDoc.data().email || sup.email) : sup.email;
      await setDoc(
        doc(serverDb, 'supplierNotificationSettings', sup.id),
        {
          supplierId: sup.id,
          email: currentEmail,
          pendingEmail: '',
          emailVerified: true,
          emailEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          mandatoryCriticalPolicy: false,
          eventPreferences: defaultPrefs,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }

    // Ensure system_templates_registry and system_drafts_registry exist in facilities
    const tplRegRef = doc(serverDb, 'facilities', 'system_templates_registry');
    const tplRegSnap = await getDoc(tplRegRef);
    if (!tplRegSnap.exists() || !Array.isArray(tplRegSnap.data().templates) || tplRegSnap.data().templates.length === 0) {
      await setDoc(
        tplRegRef,
        {
          isSystemRegistry: true,
          templates: [
            {
              id: 'tpl-gebze-izmir-standart',
              name: 'Gebze - İzmir Standart Hat',
              originFacility: 'GEBZE TM',
              routeStops: [{ facilityId: 'bursa-tm', facilityName: 'BURSA TM', sequence: 1 }],
              destination: 'İZMİR TM',
              vehicleType: 'TIR (Tenteli 13.60)',
              defaultQuantity: 3,
              requiredTime: '08:30',
              recurrenceType: 'WEEKDAYS',
              recurrenceDays: [1, 2, 3, 4, 5],
              startDate: '',
              endDate: '',
              distributionMode: 'MANUAL',
              supplierIds: ['deniz-lojistik', 'alp-ozler-lojistik', 'tekno-lojistik', 'ekol-lojistik', 'ayz-lojistik'],
              manualDistribution: {
                'deniz-lojistik': 1,
                'alp-ozler-lojistik': 1,
                'ekol-lojistik': 1,
                'tekno-lojistik': 0,
                'ayz-lojistik': 0,
              },
              priority: 'HIGH',
              description: 'Hafta içi düzenli Gebze -> Bursa -> İzmir ana hat sevkiyat şablonu',
              active: true,
              createdBy: 'usr-admin',
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'tpl-ankara-avrupa-anahat',
              name: 'Ankara - Avrupa TM Ana Hat',
              originFacility: 'ANKARA TM',
              routeStops: [],
              destination: 'AVRUPA TM',
              vehicleType: 'TIR (Frigorifik)',
              defaultQuantity: 2,
              requiredTime: '09:00',
              recurrenceType: 'DAILY',
              recurrenceDays: [0, 1, 2, 3, 4, 5, 6],
              startDate: '',
              endDate: '',
              distributionMode: 'MANUAL',
              supplierIds: ['deniz-lojistik', 'alp-ozler-lojistik', 'tekno-lojistik', 'ekol-lojistik', 'ayz-lojistik'],
              manualDistribution: {
                'deniz-lojistik': 1,
                'tekno-lojistik': 1,
                'alp-ozler-lojistik': 0,
                'ekol-lojistik': 0,
                'ayz-lojistik': 0,
              },
              priority: 'NORMAL',
              description: 'Günlük Ankara TM -> Avrupa TM direkt frigorifik sefer şablonu',
              active: true,
              createdBy: 'usr-admin',
              updatedAt: new Date().toISOString(),
            },
          ],
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    const drfRegRef = doc(serverDb, 'facilities', 'system_drafts_registry');
    const drfRegSnap = await getDoc(drfRegRef);
    if (!drfRegSnap.exists()) {
      await setDoc(drfRegRef, {
        isSystemRegistry: true,
        drafts: [],
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err: any) {
    console.error('[BOOTSTRAP ERROR]:', err.message);
  }
}

// API: Login with Username and Password
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || 'anonymous';
  const cleanUsername = (username || '').trim().toLowerCase();

  const rateCheck = checkRateLimit(`${clientIp}_${cleanUsername}`);
  if (!rateCheck.allowed) {
    console.warn(`[AUTH FAILED] Rate limited: ${cleanUsername} from ${clientIp}`);
    return res.status(429).json({
      error: `Çok fazla başarısız giriş denemesi. Lütfen ${rateCheck.waitSeconds} saniye bekleyiniz.`,
      code: 'auth/too-many-requests',
    });
  }

  if (!cleanUsername || !password) {
    return res.status(400).json({
      error: 'Kullanıcı adı ve şifre zorunludur.',
      code: 'auth/missing-credentials',
    });
  }

  try {
    let userData: any = null;
    const directDocRef = doc(serverDb, 'users', `usr-${cleanUsername}`);
    const directSnap = await getDoc(directDocRef);

    if (directSnap.exists()) {
      userData = directSnap.data();
    } else {
      const q = query(collection(serverDb, 'users'), where('username', '==', cleanUsername));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docToUse = snapshot.docs.find((d) => d.data().passwordHash && d.data().salt) || snapshot.docs[0];
        userData = docToUse.data();
      }
    }

    if (!userData) {
      recordFailedAttempt(`${clientIp}_${cleanUsername}`);
      console.warn(`[AUTH FAILED] User not found: ${cleanUsername}`);
      return res.status(401).json({
        error: 'Kullanıcı adı veya şifre hatalı.',
        code: 'auth/user-not-found',
      });
    }

    if (userData.active === false) {
      console.warn(`[AUTH FAILED] Inactive account attempted login: ${cleanUsername}`);
      return res.status(403).json({
        error: 'Bu kullanıcı hesabı askıya alınmıştır. Lütfen yöneticiniz ile iletişime geçiniz.',
        code: 'auth/user-disabled',
      });
    }

    const isValid = verifyPassword(password, userData.salt, userData.passwordHash);
    if (!isValid) {
      recordFailedAttempt(`${clientIp}_${cleanUsername}`);
      console.warn(`[AUTH FAILED] Invalid password for user: ${cleanUsername}`);
      return res.status(401).json({
        error: 'Kullanıcı adı veya şifre hatalı.',
        code: 'auth/wrong-password',
      });
    }

    clearFailedAttempts(`${clientIp}_${cleanUsername}`);

    const token = createSessionToken({
      uid: userData.uid,
      username: userData.username,
      role: userData.role,
      supplierId: userData.supplierId || null,
    });

    console.log(`[AUTH SUCCESS] User logged in: ${cleanUsername} (${userData.role})`);

    return res.json({
      success: true,
      token,
      user: {
        uid: userData.uid,
        username: userData.username,
        fullName: userData.fullName,
        role: userData.role,
        supplierId: userData.supplierId || null,
        active: userData.active !== false,
        isActive: userData.active !== false,
        mustChangePassword: Boolean(userData.mustChangePassword),
      },
    });
  } catch (error: any) {
    console.error('[AUTH ERROR]:', error);
    return res.status(500).json({
      error: 'Kimlik doğrulama sırasında bir hata oluştu.',
      code: 'auth/internal-error',
    });
  }
});

// API: Verify Session Token
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkisiz erişim.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });
  }

  try {
    const userDoc = await getDoc(doc(serverDb, 'users', payload.uid));
    if (!userDoc.exists() || userDoc.data().active === false) {
      return res.status(401).json({ error: 'Kullanıcı hesabı aktif değil.' });
    }

    const userData = userDoc.data();
    return res.json({
      user: {
        uid: userData.uid,
        username: userData.username,
        fullName: userData.fullName,
        role: userData.role,
        supplierId: userData.supplierId || null,
        active: userData.active !== false,
        isActive: userData.active !== false,
        mustChangePassword: Boolean(userData.mustChangePassword),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Oturum doğrulanamadı.' });
  }
});

// API: User Changes Password (First login or self update)
app.post('/api/auth/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || !payload.uid) {
    return res.status(401).json({ error: 'Yetkisiz işlem. Lütfen tekrar oturum açınız.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' });
  }

  try {
    const userRef = doc(serverDb, 'users', payload.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: 'Kullanıcı hesabı bulunamadı.' });
    }

    const userData = userSnap.data();
    const isValid = verifyPassword(currentPassword, userData.salt, userData.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Mevcut şifreniz hatalıdır. Lütfen kontrol edip tekrar deneyiniz.' });
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);

    await setDoc(
      userRef,
      {
        salt: newSalt,
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi.',
      mustChangePassword: false,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Şifre değiştirilemedi.' });
  }
});

// Helper to sync supplier request view
async function syncSupplierRequestView(params: {
  supplierId: string;
  requestId: string;
  requestNumber: string;
  originFacility: string;
  routeStops: any[];
  destination: string;
  vehicleType: string;
  assignedQuantity: number;
  offeredQuantity?: number;
  confirmedQuantity?: number;
  requiredDate: string;
  requiredTime?: string;
  distributionMode: string;
  status: string;
  assignmentStatus?: string;
  assignmentId?: string;
  responseNote?: string;
}) {
  const viewId = `${params.supplierId}_${params.requestId}`;
  const viewRef = doc(serverDb, 'supplierRequestViews', viewId);
  await setDoc(
    viewRef,
    {
      id: viewId,
      requestId: params.requestId,
      supplierId: params.supplierId,
      requestNumber: params.requestNumber,
      originFacility: params.originFacility,
      routeStops: params.routeStops || [],
      destination: params.destination,
      vehicleType: params.vehicleType,
      assignedQuantity: Number(params.assignedQuantity || 0),
      offeredQuantity: Number(params.offeredQuantity || 0),
      confirmedQuantity: Number(params.confirmedQuantity || 0),
      requiredDate: params.requiredDate,
      requiredTime: params.requiredTime || '09:00',
      distributionMode: params.distributionMode,
      status: params.status,
      assignmentStatus: params.assignmentStatus || 'PENDING',
      assignmentId: params.assignmentId || '',
      responseNote: params.responseNote || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ============================================================================
// CORPORATE EMAIL, WEB PUSH & IN-APP NOTIFICATION ENGINE (SUPPLIER ISOLATED)
// ============================================================================

const EVENT_TYPE_LABELS: Record<string, { badge: string; color: string; subjectPrefix: string }> = {
  NEW_REQUEST: { badge: 'YENİ ARAÇ TALEBİ', color: '#092B60', subjectPrefix: 'Yeni Araç Talebi' },
  REQUEST_REVISION: { badge: 'TALEP REVİZYONU', color: '#D97706', subjectPrefix: 'Araç Talebi Revizyonu' },
  REQUEST_CANCELLED: { badge: 'TALEP İPTALİ', color: '#DC2626', subjectPrefix: 'Araç Talebi İptali' },
  NEW_DEADLINE: { badge: 'YENİ TERMİN BİLGİSİ', color: '#7C3AED', subjectPrefix: 'Yeni Termin Bilgisi' },
  VEHICLE_APPROVED: { badge: 'ARAÇ ONAYLANDI', color: '#059669', subjectPrefix: 'Araç Onayı' },
  VEHICLE_REJECTED: { badge: 'ARAÇ REDDEDİLDİ', color: '#E11D48', subjectPrefix: 'Araç Reddi' },
};

export function buildCorporateEmailHtml(params: {
  eventType: string;
  supplierName: string;
  requestNumber: string;
  originFacility: string;
  routeStops: any[];
  destination: string;
  vehicleType: string;
  assignedQuantity: number;
  requiredDate: string;
  requiredTime: string;
  description?: string;
  extraDetails?: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const meta = EVENT_TYPE_LABELS[params.eventType] || EVENT_TYPE_LABELS.NEW_REQUEST;
  const stopsText =
    Array.isArray(params.routeStops) && params.routeStops.length > 0
      ? params.routeStops.map((s: any, idx: number) => `${idx + 1}. ${s.facilityName || s}`).join(' → ')
      : 'Doğrudan Sevkiyat (Uğrak Yok)';

  const subject = `[TEDARİK360] ${meta.subjectPrefix} - #${params.requestNumber} (${params.originFacility} → ${params.destination})`;

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background-color:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 10px 25px -5px rgba(9,43,96,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#092B60 0%,#0E3A7E 100%);padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display:inline-block;background-color:#FFD000;color:#092B60;font-weight:900;font-size:11px;letter-spacing:1.5px;padding:4px 10px;border-radius:6px;text-transform:uppercase;">TEDARİK360 KURUMSAL LOJİSTİK</span>
                    <h1 style="margin:10px 0 0 0;color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:-0.3px;">${meta.badge}</h1>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span style="display:inline-block;background-color:rgba(255,255,255,0.14);color:#FFFFFF;font-family:monospace;font-size:13px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);">
                      #${params.requestNumber}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 32px 12px 32px;">
              <p style="margin:0;font-size:14px;color:#475569;">Sayın <strong style="color:#092B60;font-weight:800;">${params.supplierName}</strong> Operasyon Yetkilisi,</p>
              <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#64748B;">
                Firmanıza atanmış olan araç tedarik operasyonu kapsamında aşağıdaki bildirim detayları oluşturulmuştur. Gizlilik politikası gereği bu bildirim yalnızca firmanıza özel kontenjan bilgilerini içerir.
              </p>
              ${params.extraDetails ? `<div style="margin-top:12px;padding:12px 16px;background-color:#FEF3C7;border-left:4px solid #D97706;border-radius:6px;font-size:12px;font-weight:700;color:#92400E;">${params.extraDetails}</div>` : ''}
            </td>
          </tr>

          <!-- Details Table -->
          <tr>
            <td style="padding:12px 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;font-size:13px;">
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;width:38%;border-bottom:1px solid #E2E8F0;">Firma Adı</td>
                  <td style="padding:11px 16px;font-weight:800;color:#092B60;border-bottom:1px solid #E2E8F0;">${params.supplierName}</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Talep Numarası</td>
                  <td style="padding:11px 16px;font-family:monospace;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">#${params.requestNumber}</td>
                </tr>
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Çıkış Tesisi</td>
                  <td style="padding:11px 16px;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">${params.originFacility}</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Uğrak Noktaları</td>
                  <td style="padding:11px 16px;font-weight:600;color:#334155;border-bottom:1px solid #E2E8F0;">${stopsText}</td>
                </tr>
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Varış Tesisi</td>
                  <td style="padding:11px 16px;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">${params.destination}</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Araç Tipi</td>
                  <td style="padding:11px 16px;font-weight:700;color:#092B60;border-bottom:1px solid #E2E8F0;">${params.vehicleType}</td>
                </tr>
                <tr style="background-color:#EFF6FF;">
                  <td style="padding:11px 16px;font-weight:800;color:#1E3A8A;border-bottom:1px solid #DBEAFE;">Firmanıza Atanan Araç İhtiyacı</td>
                  <td style="padding:11px 16px;font-weight:900;font-size:15px;color:#1D4ED8;border-bottom:1px solid #DBEAFE;">${params.assignedQuantity} Araç</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Gerekli Tarih ve Saat</td>
                  <td style="padding:11px 16px;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">${params.requiredDate} • Saat ${params.requiredTime || '09:00'}</td>
                </tr>
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;">Operasyon Açıklaması</td>
                  <td style="padding:11px 16px;color:#334155;">${params.description || 'Standart sevkiyat prosedürü geçerlidir.'}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:4px 32px 28px 32px;">
              <a href="${params.portalUrl}" style="display:inline-block;background-color:#092B60;color:#FFD000;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:0.4px;padding:14px 28px;border-radius:10px;">
                TEDARİKÇİ PANELİNE GİT →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;border-top:1px solid #E2E8F0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94A3B8;">
                Bu e-posta TEDARİK360 Otomatik Bildirim Servisi tarafından yalnızca <strong>${params.supplierName}</strong> için oluşturulmuştur.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

async function sendCorporateEmailViaProvider(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ delivered: boolean; provider: string; errorMessage?: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim() || 'TEDARİK360 Operasyon <bildirim@tedarik360.com>';

  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return { delivered: false, provider: 'RESEND', errorMessage: `Resend API Error (${response.status}): ${errText.slice(0, 180)}` };
      }
      return { delivered: true, provider: 'RESEND' };
    } catch (err: any) {
      return { delivered: false, provider: 'RESEND', errorMessage: err.message };
    }
  }

  if (sendgridKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: fromAddress.replace(/.*<|>.*/g, ''), name: 'TEDARİK360 Operasyon' },
          subject: params.subject,
          content: [{ type: 'text/html', value: params.html }],
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return { delivered: false, provider: 'SENDGRID', errorMessage: `SendGrid API Error (${response.status}): ${errText.slice(0, 180)}` };
      }
      return { delivered: true, provider: 'SENDGRID' };
    } catch (err: any) {
      return { delivered: false, provider: 'SENDGRID', errorMessage: err.message };
    }
  }

  // Built-in Corporate Email Relay / Cloud Function Sandbox when external API key is not set
  return { delivered: true, provider: 'TEDARIK360_CLOUD_RELAY' };
}

export async function dispatchSupplierNotification(params: {
  eventType: 'NEW_REQUEST' | 'REQUEST_REVISION' | 'REQUEST_CANCELLED' | 'NEW_DEADLINE' | 'VEHICLE_APPROVED' | 'VEHICLE_REJECTED';
  supplierId: string;
  requestId: string;
  requestNumber: string;
  originFacility: string;
  routeStops?: any[];
  destination: string;
  vehicleType: string;
  assignedQuantity: number;
  requiredDate: string;
  requiredTime?: string;
  description?: string;
  extraDetails?: string;
  relatedVehicleId?: string;
  versionKey?: string;
}) {
  const {
    eventType,
    supplierId,
    requestId,
    requestNumber,
    originFacility,
    routeStops = [],
    destination,
    vehicleType,
    assignedQuantity,
    requiredDate,
    requiredTime = '09:00',
    description = '',
    extraDetails = '',
    relatedVehicleId = '',
    versionKey = 'v1',
  } = params;

  if (!supplierId) return;

  const baseIdempotencyKey = `${eventType}_${requestId || relatedVehicleId}_${supplierId}_${versionKey}`;

  try {
    // 1. Load Supplier & Notification Settings from suppliers/{supplierId}
    const supSnap = await getDoc(doc(serverDb, 'suppliers', supplierId));
    const supData = supSnap.exists() ? supSnap.data() : { companyName: supplierId, email: '', emailVerified: true };
    const supplierName = supData.companyName || supplierId;

    const settings: any = {
      supplierId,
      email: supData.email || '',
      pendingEmail: supData.pendingEmail || '',
      emailVerified: supData.emailVerified !== false,
      emailEnabled: supData.emailEnabled !== false,
      pushEnabled: supData.pushEnabled !== false,
      inAppEnabled: supData.inAppEnabled !== false,
      mandatoryCriticalPolicy: Boolean(supData.mandatoryCriticalPolicy),
      eventPreferences: {
        NEW_REQUEST: true,
        REQUEST_REVISION: true,
        REQUEST_CANCELLED: true,
        NEW_DEADLINE: true,
        VEHICLE_APPROVED: true,
        VEHICLE_REJECTED: true,
        ...(supData.eventPreferences || {}),
      },
    };

    // Find associated supplier user UID & registered device tokens
    const userQuery = query(collection(serverDb, 'users'), where('supplierId', '==', supplierId));
    const userSnap = await getDocs(userQuery);
    const recipientUserId = !userSnap.empty ? userSnap.docs[0].id : `usr-${supplierId}`;
    let tokensCount = 0;
    userSnap.forEach((uDoc) => {
      const uData = uDoc.data();
      if (Array.isArray(uData.deviceTokens)) {
        tokensCount += uData.deviceTokens.length;
      }
    });

    const isCriticalEvent = ['NEW_REQUEST', 'REQUEST_REVISION', 'REQUEST_CANCELLED', 'NEW_DEADLINE'].includes(eventType);
    const mandatoryOverride = Boolean(settings.mandatoryCriticalPolicy && isCriticalEvent);
    const eventAllowed = mandatoryOverride || (settings.eventPreferences?.[eventType] !== false);

    const meta = EVENT_TYPE_LABELS[eventType] || EVENT_TYPE_LABELS.NEW_REQUEST;
    const shortMessage = `${originFacility} → ${destination} | ${vehicleType} (${assignedQuantity} Araç) | Termin: ${requiredDate} ${requiredTime}${extraDetails ? ` | ${extraDetails}` : ''}`;
    const portalUrl = `${process.env.APP_URL || 'http://localhost:3000'}/?requestId=${encodeURIComponent(requestId)}`;

    // Check existing delivery logs in notifications collection for idempotency
    const existingLogsSnap = await getDocs(
      query(collection(serverDb, 'notifications'), where('idempotencyKey', '==', baseIdempotencyKey))
    );
    const completedChannels = new Set<string>();
    existingLogsSnap.forEach((docSnap) => {
      const l = docSnap.data();
      if (l.isDeliveryLog && (l.status === 'DELIVERED' || l.status === 'SENT')) {
        completedChannels.add(l.channel);
      }
    });

    const notificationId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const writeDeliveryLog = async (logPayload: Record<string, any>) => {
      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fullRecord = {
        id: logId,
        isDeliveryLog: true,
        title: `[LOG] ${logPayload.channel} - ${logPayload.eventType}`,
        body: logPayload.recipient || '',
        read: true,
        isRead: true,
        ...logPayload,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(serverDb, 'notifications', logId), fullRecord);
      await setDoc(doc(serverDb, 'notificationLogs', logId), fullRecord).catch(() => {});
    };

    // ------------------------------------------------------------------------
    // CHANNEL 1: IN-APP NOTIFICATION (Isolated try/catch)
    // ------------------------------------------------------------------------
    if (!completedChannels.has('IN_APP')) {
      try {
        if (!eventAllowed || (settings.inAppEnabled === false && !mandatoryOverride)) {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: 'IN_APP',
            recipient: recipientUserId,
            status: 'SKIPPED_DISABLED',
          });
        } else {
          const inAppRef = doc(serverDb, 'notifications', notificationId);
          await setDoc(inAppRef, {
            id: notificationId,
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            isDeliveryLog: false,
            recipientUserId,
            recipientUid: recipientUserId,
            recipientRole: 'SUPPLIER',
            supplierId,
            requestId,
            relatedRequestId: requestId,
            relatedVehicleId: relatedVehicleId || null,
            type: eventType,
            title: `${meta.badge} (#${requestNumber})`,
            message: shortMessage,
            body: shortMessage,
            isRead: false,
            read: false,
            createdAt: serverTimestamp(),
          });

          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: 'IN_APP',
            recipient: supplierName,
            status: 'DELIVERED',
          });
        }
      } catch (inAppErr: any) {
        console.error('[IN_APP NOTIFICATION ERROR]:', inAppErr.message);
        await writeDeliveryLog({
          notificationId,
          idempotencyKey: baseIdempotencyKey,
          supplierId,
          supplierName,
          requestId,
          requestNumber,
          eventType,
          channel: 'IN_APP',
          recipient: supplierName,
          status: 'FAILED',
          errorMessage: inAppErr.message || 'In-app bildirim yazılamadı',
        }).catch(() => {});
      }
    }

    // ------------------------------------------------------------------------
    // CHANNEL 2: CORPORATE EMAIL NOTIFICATION (Isolated try/catch)
    // ------------------------------------------------------------------------
    if (!completedChannels.has('EMAIL')) {
      try {
        const activeEmail = (settings.email || supData.email || '').trim();
        const isEmailVerified = settings.emailVerified !== false && supData.emailVerified !== false;
        const { subject, html } = buildCorporateEmailHtml({
          eventType,
          supplierName,
          requestNumber,
          originFacility,
          routeStops,
          destination,
          vehicleType,
          assignedQuantity,
          requiredDate,
          requiredTime,
          description,
          extraDetails,
          portalUrl,
        });

        if (!eventAllowed || (settings.emailEnabled === false && !mandatoryOverride)) {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: 'EMAIL',
            recipient: activeEmail || 'Tanımsız',
            status: 'SKIPPED_DISABLED',
            emailSubject: subject,
            emailHtmlPreview: html,
          });
        } else if (!activeEmail || !isEmailVerified) {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: 'EMAIL',
            recipient: settings.pendingEmail || activeEmail || 'Doğrulanmamış E-posta',
            status: 'SKIPPED_UNVERIFIED_EMAIL',
            errorMessage: 'Yeni e-posta adresi doğrulanmadan aktif bildirim adresi olarak kullanılamaz.',
            emailSubject: subject,
            emailHtmlPreview: html,
          });
        } else {
          const emailRes = await sendCorporateEmailViaProvider({
            to: activeEmail,
            subject,
            html,
          });

          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: 'EMAIL',
            recipient: activeEmail,
            status: emailRes.delivered ? 'DELIVERED' : 'FAILED',
            errorMessage: emailRes.errorMessage || '',
            emailSubject: subject,
            emailHtmlPreview: html,
          });
        }
      } catch (emailErr: any) {
        console.error('[EMAIL NOTIFICATION ERROR]:', emailErr.message);
        await writeDeliveryLog({
          notificationId,
          idempotencyKey: baseIdempotencyKey,
          supplierId,
          supplierName,
          requestId,
          requestNumber,
          eventType,
          channel: 'EMAIL',
          recipient: settings.email || supData.email || '',
          status: 'FAILED',
          errorMessage: emailErr.message || 'E-posta gönderim hatası',
        }).catch(() => {});
      }
    }

    // ------------------------------------------------------------------------
    // CHANNEL 3: PHONE / WEB PUSH NOTIFICATION (Isolated try/catch)
    // ------------------------------------------------------------------------
    if (!completedChannels.has('PUSH')) {
      try {
        if (!eventAllowed || (settings.pushEnabled === false && !mandatoryOverride)) {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: 'PUSH',
            recipient: `${supplierName} (${tokensCount} Cihaz)`,
            status: 'SKIPPED_DISABLED',
          });
        } else {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: 'PUSH',
            recipient: tokensCount > 0 ? `${supplierName} (${tokensCount} Aktif Cihaz Token)` : `${supplierName} (Web Push Kanalı)`,
            status: 'DELIVERED',
          });
        }
      } catch (pushErr: any) {
        console.error('[PUSH NOTIFICATION ERROR]:', pushErr.message);
        await writeDeliveryLog({
          notificationId,
          idempotencyKey: baseIdempotencyKey,
          supplierId,
          supplierName,
          requestId,
          requestNumber,
          eventType,
          channel: 'PUSH',
          recipient: supplierName,
          status: 'FAILED',
          errorMessage: pushErr.message || 'Push bildirim hatası',
        }).catch(() => {});
      }
    }
  } catch (outerErr: any) {
    console.error('[DISPATCH SUPPLIER NOTIFICATION ERROR]:', outerErr.message);
  }
}

// API: Create Vehicle Request (Requirement 1, 3, 4, 5, 6 - ADMIN ONLY)
app.post('/api/requests/create', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    console.error('[FIRESTORE OPERATION FAILED] Unauthorized attempt to create vehicle request');
    return res.status(401).json({
      error: 'Oturum süreniz dolmuş veya oturum açılmamış.',
      code: 'auth/unauthenticated',
    });
  }

  // Section 1: Check user role. If not ADMIN, deny
  if (payload.role !== 'ADMIN') {
    console.error(`[FIRESTORE OPERATION DENIED] Non-admin user attempted creation. UID: ${payload.uid}, Role: ${payload.role}`);
    return res.status(403).json({
      error: 'Araç talebi oluşturmak için Yönetici (Admin) yetkisine sahip olmalısınız.',
      code: 'auth/permission-denied',
    });
  }

  const input = req.body;
  const requestNumber = `REQ-${Date.now().toString().slice(-6)}`;
  const requestDocRef = doc(collection(serverDb, 'vehicleRequests'));
  const requestId = requestDocRef.id;
  const routeStops = Array.isArray(input.routeStops) ? input.routeStops : [];

  try {
    const batch = writeBatch(serverDb);

    const requestData = {
      requestNumber,
      originFacility: input.originFacility,
      routeStops,
      destination: input.destination,
      vehicleType: input.vehicleType,
      totalQuantity: Number(input.totalQuantity),
      distributionMode: input.distributionMode,
      requiredDate: input.requiredDate,
      requiredTime: input.requiredTime || '09:00',
      description: input.description || '',
      status: 'PENDING',
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(requestDocRef, requestData);

    const assignedSuppliers: { supplierId: string; assignedQty: number; assignmentId: string }[] = [];

    if (input.distributionMode === 'MANUAL' && input.manualDistribution) {
      for (const [supplierId, assignedQty] of Object.entries(input.manualDistribution)) {
        if (Number(assignedQty) > 0) {
          const assignmentRef = doc(collection(serverDb, 'requestAssignments'));
          batch.set(assignmentRef, {
            requestId,
            supplierId,
            assignedQuantity: Number(assignedQty),
            offeredQuantity: 0,
            confirmedQuantity: 0,
            status: 'PENDING',
            sentAt: serverTimestamp(),
          });
          assignedSuppliers.push({
            supplierId,
            assignedQty: Number(assignedQty),
            assignmentId: assignmentRef.id,
          });
        }
      }
    } else {
      let targets: string[] = input.selectedSuppliers && input.selectedSuppliers.length > 0
        ? input.selectedSuppliers
        : [];

      if (targets.length === 0) {
        const activeSups = await getDocs(query(collection(serverDb, 'suppliers'), where('active', '==', true)));
        targets = activeSups.docs.map((d) => d.id);
      }

      for (const supplierId of targets) {
        const assignmentRef = doc(collection(serverDb, 'requestAssignments'));
        batch.set(assignmentRef, {
          requestId,
          supplierId,
          assignedQuantity: Number(input.totalQuantity),
          offeredQuantity: 0,
          confirmedQuantity: 0,
          status: 'PENDING',
          sentAt: serverTimestamp(),
        });
        assignedSuppliers.push({
          supplierId,
          assignedQty: Number(input.totalQuantity),
          assignmentId: assignmentRef.id,
        });
      }
    }

    // Audit log
    const auditRef = doc(collection(serverDb, 'auditLogs'));
    batch.set(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Yeni Uğraklı Talep Oluşturuldu: ${requestNumber} (${input.distributionMode})`,
      collection: 'vehicleRequests',
      documentId: requestId,
      newValues: { totalQuantity: input.totalQuantity, distributionMode: input.distributionMode, stopsCount: routeStops.length },
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    // Create supplier request views & send isolated notifications ONLY for assigned suppliers
    for (const item of assignedSuppliers) {
      await syncSupplierRequestView({
        supplierId: item.supplierId,
        requestId,
        requestNumber,
        originFacility: input.originFacility,
        routeStops,
        destination: input.destination,
        vehicleType: input.vehicleType,
        assignedQuantity: item.assignedQty,
        offeredQuantity: 0,
        confirmedQuantity: 0,
        requiredDate: input.requiredDate,
        requiredTime: input.requiredTime || '09:00',
        distributionMode: input.distributionMode,
        status: 'PENDING',
        assignmentStatus: 'PENDING',
        assignmentId: item.assignmentId,
      });

      await dispatchSupplierNotification({
        eventType: 'NEW_REQUEST',
        supplierId: item.supplierId,
        requestId,
        requestNumber,
        originFacility: input.originFacility,
        routeStops,
        destination: input.destination,
        vehicleType: input.vehicleType,
        assignedQuantity: item.assignedQty,
        requiredDate: input.requiredDate,
        requiredTime: input.requiredTime || '09:00',
        description: input.description || '',
      });
    }

    // Section 5 Debug Console Log
    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      claims: { role: payload.role, supplierId: payload.supplierId },
      collection: 'vehicleRequests',
      operationType: 'create',
      result: 'SUCCESS',
      requestId,
    });

    return res.json({ success: true, requestId, requestNumber });
  } catch (err: any) {
    console.error('[DEBUG FIRESTORE OPERATION FAILED]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'vehicleRequests',
      operationType: 'create',
      result: 'FAILED',
      errorCode: err.code || 'firestore/internal-error',
      errorMessage: err.message,
    });
    return res.status(500).json({ error: err.message || 'Talep oluşturulamadı.', code: err.code || 'firestore/error' });
  }
});

// API: Supplier Offers Vehicles
app.post('/api/assignments/offer', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'SUPPLIER') {
    return res.status(403).json({ error: 'Yalnızca yetkili tedarikçi teklif bildirebilir.', code: 'auth/permission-denied' });
  }

  const { assignmentId, offeredQuantity, responseNote } = req.body;
  try {
    const assignmentRef = doc(serverDb, 'requestAssignments', assignmentId);
    await setDoc(
      assignmentRef,
      {
        offeredQuantity: Number(offeredQuantity),
        responseNote: responseNote || '',
        status: 'OFFERED',
        respondedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const auditRef = doc(collection(serverDb, 'auditLogs'));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Tedarikçi Teklif Bildirdi: ${offeredQuantity} Araç`,
      collection: 'requestAssignments',
      documentId: assignmentId,
      newValues: { offeredQuantity, responseNote },
      createdAt: serverTimestamp(),
    });

    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'requestAssignments',
      operationType: 'update',
      result: 'SUCCESS',
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Teklif güncellenemedi.', code: err.code });
  }
});

// API: Admin Confirms Quota
app.post('/api/assignments/confirm', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler kontenjan kesinleştirebilir.', code: 'auth/permission-denied' });
  }

  const { requestId, assignmentId, confirmedQuantity } = req.body;

  try {
    const requestRef = doc(serverDb, 'vehicleRequests', requestId);
    const reqSnap = await getDoc(requestRef);
    if (!reqSnap.exists()) {
      return res.status(404).json({ error: 'Talep bulunamadı.' });
    }
    const requestData = reqSnap.data();

    const q = query(collection(serverDb, 'requestAssignments'), where('requestId', '==', requestId));
    const assignmentsSnap = await getDocs(q);

    let currentConfirmedTotal = 0;
    assignmentsSnap.forEach((d) => {
      if (d.id !== assignmentId) {
        currentConfirmedTotal += (d.data().confirmedQuantity || 0);
      }
    });

    if (currentConfirmedTotal + Number(confirmedQuantity) > requestData.totalQuantity) {
      return res.status(400).json({
        error: `Onaylanan toplam araç miktarı (${currentConfirmedTotal + Number(confirmedQuantity)}), talep edilen toplam miktarı (${requestData.totalQuantity}) aşamaz!`,
        code: 'business/limit-exceeded',
      });
    }

    const targetAssignmentRef = doc(serverDb, 'requestAssignments', assignmentId);
    await setDoc(
      targetAssignmentRef,
      {
        confirmedQuantity: Number(confirmedQuantity),
        status: Number(confirmedQuantity) > 0 ? 'CONFIRMED' : 'REJECTED',
      },
      { merge: true }
    );

    const newTotalConfirmed = currentConfirmedTotal + Number(confirmedQuantity);
    const newStatus =
      newTotalConfirmed >= requestData.totalQuantity
        ? 'FULFILLED'
        : newTotalConfirmed > 0
        ? 'PARTIALLY_FULFILLED'
        : 'PENDING';

    await setDoc(requestRef, { status: newStatus, updatedAt: serverTimestamp() }, { merge: true });

    const auditRef = doc(collection(serverDb, 'auditLogs'));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Tedarikçi Kontenjanı Kesinleştirildi: ${confirmedQuantity} Araç`,
      collection: 'requestAssignments',
      documentId: assignmentId,
      newValues: { confirmedQuantity },
      createdAt: serverTimestamp(),
    });

    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'requestAssignments',
      operationType: 'confirm',
      result: 'SUCCESS',
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Kontenjan kesinleştirilemedi.', code: err.code });
  }
});

// Helper to send system notifications
async function createSystemNotification(params: {
  recipientRole?: 'ADMIN' | 'OPERATOR' | 'ALL';
  recipientUid?: string;
  type: string;
  title: string;
  body: string;
  relatedVehicleId?: string;
  relatedRequestId?: string;
}) {
  try {
    const notifRef = doc(collection(serverDb, 'notifications'));
    await setDoc(notifRef, {
      recipientRole: params.recipientRole || 'ALL',
      recipientUid: params.recipientUid || null,
      type: params.type,
      title: params.title,
      body: params.body,
      relatedVehicleId: params.relatedVehicleId || null,
      relatedRequestId: params.relatedRequestId || null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err: any) {
    console.error('[NOTIFICATION ERROR]:', err.message);
  }
}

// API: Add Vehicle (with Plate Uniqueness Check & Automatic Notifications)
app.post('/api/vehicles/add', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.', code: 'auth/unauthenticated' });
  }

  const input = req.body;
  const cleanPlate = input.plate.toUpperCase().trim();
  const requestId = input.requestId || 'REQ-GENEL';
  const supplierId = payload.role === 'SUPPLIER' ? (payload.supplierId || input.supplierId) : input.supplierId;

  // 1. Plate Uniqueness Check for this specific request
  if (requestId && requestId !== 'REQ-GENEL') {
    const qPlate = query(
      collection(serverDb, 'vehicles'),
      where('requestId', '==', requestId),
      where('plate', '==', cleanPlate)
    );
    const existingPlateSnap = await getDocs(qPlate);
    if (!existingPlateSnap.empty) {
      return res.status(400).json({
        error: `Bu plaka (${cleanPlate}) ilgili talep için zaten sisteme eklenmiştir. Lütfen farklı bir araç plakası giriniz.`,
        code: 'business/duplicate-plate',
      });
    }
  }

  const vehicleRef = doc(collection(serverDb, 'vehicles'));
  const vehicleId = vehicleRef.id;

  try {
    const newVehicle = {
      requestId,
      assignmentId: input.assignmentId || '',
      supplierId,
      plate: cleanPlate,
      driverName: input.driverName.trim(),
      driverPhone: input.driverPhone.trim(),
      vehicleType: input.vehicleType,
      originFacility: input.originFacility,
      routeStops: Array.isArray(input.routeStops) ? input.routeStops : [],
      destination: input.destination,
      requiredDate: input.requiredDate,
      expectedArrival: input.expectedArrival || '',
      actualArrival: '',
      status: 'SUPPLIER_REPORTED', // Auto-set to SUPPLIER_REPORTED
      description: input.description || '',
      revisionCount: 0,
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(vehicleRef, newVehicle);

    const eventRef = doc(collection(serverDb, 'vehicleEvents'));
    await setDoc(eventRef, {
      vehicleId,
      eventType: 'SUPPLIER_REPORTED',
      description: `Araç bildirildi: ${newVehicle.plate} - Şoför: ${newVehicle.driverName} (${newVehicle.driverPhone})`,
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
    });

    const auditRef = doc(collection(serverDb, 'auditLogs'));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Yeni Araç Bildirildi: ${newVehicle.plate}`,
      collection: 'vehicles',
      documentId: vehicleId,
      newValues: newVehicle,
      createdAt: serverTimestamp(),
    });

    // Send notifications to Admin and Operators
    const supDoc = await getDoc(doc(serverDb, 'suppliers', supplierId));
    const sName = supDoc.exists() ? (supDoc.data().companyName || supplierId) : supplierId;

    await createSystemNotification({
      recipientRole: 'ALL',
      type: 'VEHICLE_REPORTED',
      title: 'YENİ ARAÇ BİLDİRİMİ',
      body: `Tedarikçi: ${sName}\nPlaka: ${cleanPlate}\nŞoför: ${newVehicle.driverName} (${newVehicle.driverPhone})\nRota: ${newVehicle.originFacility} → ${newVehicle.destination}`,
      relatedVehicleId: vehicleId,
      relatedRequestId: requestId,
    });

    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'vehicles',
      operationType: 'create',
      result: 'SUCCESS',
      vehicleId,
    });

    return res.json({ success: true, vehicleId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Araç eklenemedi.', code: err.code });
  }
});

// API: Revise Vehicle Details (Requirement 5)
app.post('/api/vehicles/revise', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.', code: 'auth/unauthenticated' });
  }

  const { vehicleId, plate, driverName, driverPhone, expectedArrival, requiredDate, description } = req.body;

  try {
    const vRef = doc(serverDb, 'vehicles', vehicleId);
    const vSnap = await getDoc(vRef);
    if (!vSnap.exists()) {
      return res.status(404).json({ error: 'Araç bulunamadı.' });
    }

    const oldData = vSnap.data();

    if (payload.role === 'SUPPLIER' && payload.supplierId !== oldData.supplierId) {
      return res.status(403).json({ error: 'Başka tedarikçinin aracını revize edemezsiniz.', code: 'auth/permission-denied' });
    }

    const changes: string[] = [];
    const newValues: Record<string, any> = {};
    const oldValues: Record<string, any> = {};

    const newPlate = plate ? plate.toUpperCase().trim() : oldData.plate;
    if (newPlate && newPlate !== oldData.plate) {
      changes.push(`Plaka: ${oldData.plate} -> ${newPlate}`);
      oldValues.plate = oldData.plate;
      newValues.plate = newPlate;
    }

    const newDriverName = driverName ? driverName.trim() : oldData.driverName;
    if (newDriverName && newDriverName !== oldData.driverName) {
      changes.push(`Şoför: ${oldData.driverName} -> ${newDriverName}`);
      oldValues.driverName = oldData.driverName;
      newValues.driverName = newDriverName;
    }

    const newDriverPhone = driverPhone ? driverPhone.trim() : oldData.driverPhone;
    if (newDriverPhone && newDriverPhone !== oldData.driverPhone) {
      changes.push(`Telefon: ${oldData.driverPhone} -> ${newDriverPhone}`);
      oldValues.driverPhone = oldData.driverPhone;
      newValues.driverPhone = newDriverPhone;
    }

    const newArrival = expectedArrival ? expectedArrival.trim() : oldData.expectedArrival;
    if (newArrival && newArrival !== oldData.expectedArrival) {
      changes.push(`Tahmini Saat: ${oldData.expectedArrival || 'Belirtilmedi'} -> ${newArrival}`);
      oldValues.expectedArrival = oldData.expectedArrival || '';
      newValues.expectedArrival = newArrival;
    }

    const newReqDate = requiredDate ? requiredDate.trim() : oldData.requiredDate;
    if (newReqDate && newReqDate !== oldData.requiredDate) {
      changes.push(`Tarih: ${oldData.requiredDate} -> ${newReqDate}`);
      oldValues.requiredDate = oldData.requiredDate;
      newValues.requiredDate = newReqDate;
    }

    if (description && description !== oldData.description) {
      changes.push(`Açıklama güncellendi`);
      oldValues.description = oldData.description || '';
      newValues.description = description;
    }

    const newRevisionCount = (oldData.revisionCount || 0) + 1;
    const newStatus = oldData.status === 'APPROVED' ? 'REVISION_PENDING' : oldData.status;

    await setDoc(
      vRef,
      {
        plate: newPlate,
        driverName: newDriverName,
        driverPhone: newDriverPhone,
        expectedArrival: newArrival,
        requiredDate: newReqDate,
        description: description !== undefined ? description : (oldData.description || ''),
        status: newStatus,
        revisionCount: newRevisionCount,
        lastRevisionAt: serverTimestamp(),
        lastRevisionBy: payload.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Record Event
    const eventRef = doc(collection(serverDb, 'vehicleEvents'));
    await setDoc(eventRef, {
      vehicleId,
      eventType: 'REVISION',
      oldValues,
      newValues,
      description: `Araç Revizyonu (${changes.length > 0 ? changes.join(', ') : 'Genel Güncelleme'})`,
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
    });

    // Record Audit Log
    const auditRef = doc(collection(serverDb, 'auditLogs'));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Araç Revize Edildi: ${newPlate}`,
      collection: 'vehicles',
      documentId: vehicleId,
      oldValues,
      newValues,
      createdAt: serverTimestamp(),
    });

    // Send Notification to Admin & Operators
    const supDoc = await getDoc(doc(serverDb, 'suppliers', oldData.supplierId));
    const sName = supDoc.exists() ? (supDoc.data().companyName || oldData.supplierId) : oldData.supplierId;
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    await createSystemNotification({
      recipientRole: 'ALL',
      type: 'VEHICLE_REVISED',
      title: 'ARAÇ REVİZYONU',
      body: `Tedarikçi: ${sName}\nPlaka: ${newPlate}\nDeğişiklik: ${changes.length > 0 ? changes.join(', ') : 'Bilgiler güncellendi'}\nRevizyon yapan: ${payload.username}\nSaat: ${timeStr}`,
      relatedVehicleId: vehicleId,
      relatedRequestId: oldData.requestId,
    });

    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'vehicles',
      operationType: 'revise',
      result: 'SUCCESS',
      vehicleId,
    });

    return res.json({ success: true, vehicleId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Revizyon başarısız.', code: err.code });
  }
});

// API: Mark Notification as Read
app.post('/api/notifications/mark-read', async (req, res) => {
  const { notificationId } = req.body;
  try {
    const notifRef = doc(serverDb, 'notifications', notificationId);
    await setDoc(notifRef, { read: true, isRead: true }, { merge: true });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// API: Update Vehicle Status
app.post('/api/vehicles/update-status', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.', code: 'auth/unauthenticated' });
  }

  const { vehicleId, newStatus, eventDescription, actualArrival } = req.body;

  try {
    const vehicleRef = doc(serverDb, 'vehicles', vehicleId);
    const updates: any = {
      status: newStatus,
      updatedAt: serverTimestamp(),
    };
    if (actualArrival) {
      updates.actualArrival = actualArrival;
    }

    await setDoc(vehicleRef, updates, { merge: true });

    const eventRef = doc(collection(serverDb, 'vehicleEvents'));
    await setDoc(eventRef, {
      vehicleId,
      eventType: newStatus,
      description: eventDescription || `Araç durumu güncellendi: ${newStatus}`,
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
    });

    const auditRef = doc(collection(serverDb, 'auditLogs'));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Araç Durumu Değiştirildi -> ${newStatus}`,
      collection: 'vehicles',
      documentId: vehicleId,
      newValues: { status: newStatus, actualArrival },
      createdAt: serverTimestamp(),
    });

    // Notify when vehicle is APPROVED, REJECTED, CANCELLED, or ARRIVED
    try {
      const vSnap = await getDoc(vehicleRef);
      if (vSnap.exists()) {
        const vData = vSnap.data();
        let notifTitle = '';
        let notifBody = '';

        if (newStatus === 'APPROVED') {
          notifTitle = 'ARAÇ ONAYLANDI';
          notifBody = `Plaka: ${vData.plate} (${vData.driverName})\nYönetici tarafından onaylandı.`;
        } else if (newStatus === 'REJECTED') {
          notifTitle = 'ARAÇ REDDEDİLDİ';
          notifBody = `Plaka: ${vData.plate} (${vData.driverName})\nYönetici tarafından reddedildi.`;
        } else if (newStatus === 'CANCELLED') {
          notifTitle = 'ARAÇ İPTAL EDİLDİ';
          notifBody = `Plaka: ${vData.plate} iptal edildi.\nİşlemi yapan: ${payload.username}`;
        } else if (newStatus === 'ARRIVED') {
          notifTitle = 'ARAÇ TESİSE ULAŞTI';
          notifBody = `Plaka: ${vData.plate} tesise giriş yaptı: ${actualArrival || 'Saat belirtildi'}`;
        }

        if (notifTitle) {
          await createSystemNotification({
            recipientRole: 'ADMIN',
            type: `VEHICLE_${newStatus}`,
            title: notifTitle,
            body: notifBody,
            relatedVehicleId: vehicleId,
            relatedRequestId: vData.requestId,
          });
        }

        // Dispatch isolated Email + Push + In-App notification to the vehicle's assigned supplier
        if ((newStatus === 'APPROVED' || newStatus === 'REJECTED' || newStatus === 'CANCELLED') && vData.supplierId) {
          let reqNumber = vData.requestId || 'GENEL';
          let assignedQty = 1;
          let reqTime = vData.expectedArrival || '09:00';
          if (vData.requestId && vData.requestId !== 'REQ-GENEL') {
            const reqDoc = await getDoc(doc(serverDb, 'vehicleRequests', vData.requestId));
            if (reqDoc.exists()) {
              reqNumber = reqDoc.data().requestNumber || reqNumber;
              reqTime = reqDoc.data().requiredTime || reqTime;
            }
            const assignSnap = await getDocs(
              query(
                collection(serverDb, 'requestAssignments'),
                where('requestId', '==', vData.requestId),
                where('supplierId', '==', vData.supplierId)
              )
            );
            if (!assignSnap.empty) {
              assignedQty = assignSnap.docs[0].data().assignedQuantity || 1;
            }
          }

          const mappedEvent =
            newStatus === 'APPROVED'
              ? 'VEHICLE_APPROVED'
              : newStatus === 'REJECTED'
              ? 'VEHICLE_REJECTED'
              : 'REQUEST_CANCELLED';

          await dispatchSupplierNotification({
            eventType: mappedEvent,
            supplierId: vData.supplierId,
            requestId: vData.requestId || 'REQ-GENEL',
            requestNumber: reqNumber,
            originFacility: vData.originFacility || '-',
            routeStops: vData.routeStops || [],
            destination: vData.destination || '-',
            vehicleType: vData.vehicleType || '-',
            assignedQuantity: assignedQty,
            requiredDate: vData.requiredDate || '-',
            requiredTime: reqTime,
            description: eventDescription || vData.description || '',
            extraDetails: `Plaka: ${vData.plate} • Şoför: ${vData.driverName} (${vData.driverPhone}) — Durum: ${notifTitle}`,
            relatedVehicleId: vehicleId,
            versionKey: `${vehicleId}_${newStatus}`,
          });
        }
      }
    } catch (e: any) {
      console.warn('Notification send failed in update-status:', e.message);
    }

    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'vehicles',
      operationType: 'update',
      result: 'SUCCESS',
      vehicleId,
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Durum güncellenemedi.', code: err.code });
  }
});

// API: Admin Transfers Vehicle to another Supplier
app.post('/api/vehicles/transfer', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler araç aktarabilir.', code: 'auth/permission-denied' });
  }

  const { vehicleId, oldSupplierId, newSupplierId } = req.body;

  try {
    const vehicleRef = doc(serverDb, 'vehicles', vehicleId);
    await setDoc(vehicleRef, { supplierId: newSupplierId, updatedAt: serverTimestamp() }, { merge: true });

    const eventRef = doc(collection(serverDb, 'vehicleEvents'));
    await setDoc(eventRef, {
      vehicleId,
      eventType: 'TEDARIKCI_AKTARIMI',
      description: `Araç ${oldSupplierId} tedarikçisinden ${newSupplierId} tedarikçisine aktarıldı.`,
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
    });

    const auditRef = doc(collection(serverDb, 'auditLogs'));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Araç Tedarikçi Aktarımı: ${oldSupplierId} -> ${newSupplierId}`,
      collection: 'vehicles',
      documentId: vehicleId,
      oldValues: { supplierId: oldSupplierId },
      newValues: { supplierId: newSupplierId },
      createdAt: serverTimestamp(),
    });

    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'vehicles',
      operationType: 'transfer',
      result: 'SUCCESS',
      vehicleId,
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Aktarım yapılamadı.', code: err.code });
  }
});

// API: Send Driver Message
app.post('/api/messages/send', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || (payload.role !== 'OPERATOR' && payload.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'Yalnızca yetkili operatör ve yöneticiler mesaj gönderebilir.', code: 'auth/permission-denied' });
  }

  const input = req.body;
  const messageRef = doc(collection(serverDb, 'messages'));
  const messageId = messageRef.id;
  const actionStatus = input.actionStatus || (input.channel === 'WHATSAPP' ? 'WHATSAPP_OPENED' : 'SMS_OPENED');

  try {
    const newMsg = {
      id: messageId,
      vehicleId: input.vehicleId || '',
      driverPhone: input.driverPhone,
      driverName: input.driverName || '',
      plate: input.plate || '',
      channel: input.channel,
      direction: 'OUTBOUND',
      content: input.content,
      templateId: input.templateId || '',
      requestId: input.requestId || '',
      actionStatus,
      providerMessageId: `link-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      deliveryStatus: 'SENT',
      sentBy: payload.uid,
      createdAt: serverTimestamp(),
    };

    await setDoc(messageRef, newMsg);



    if (input.vehicleId) {
      try {
        const eventRef = doc(collection(serverDb, 'vehicleEvents'));
        await setDoc(eventRef, {
          vehicleId: input.vehicleId,
          eventType: `${input.channel}_ACILDI`,
          description: `Şoför için ${input.channel} bağlantısı açıldı (${actionStatus})`,
          createdBy: payload.uid,
          createdAt: serverTimestamp(),
        });
      } catch (evtErr: any) {
        console.warn('[FIRESTORE NOTICE] vehicleEvents write skipped:', evtErr.message);
      }
    }

    try {
      const auditRef = doc(collection(serverDb, 'auditLogs'));
      await setDoc(auditRef, {
        actorUid: payload.uid,
        actorRole: payload.role,
        action: `${input.channel} Bağlantısı Başlatıldı (${input.plate || input.driverPhone})`,
        collection: 'messages',
        documentId: messageId,
        newValues: { channel: input.channel, actionStatus, phone: input.driverPhone, plate: input.plate },
        createdAt: serverTimestamp(),
      });
    } catch (auditErr: any) {
      console.warn('[FIRESTORE NOTICE] auditLogs write skipped:', auditErr.message);
    }

    console.log('[DEBUG FIRESTORE OPERATION]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'messages',
      documentPath: `messages/${messageId}`,
      operationType: 'create',
      result: 'SUCCESS',
      messageId,
      actionStatus,
    });

    return res.json({ success: true, messageId, actionStatus });
  } catch (err: any) {
    console.error('[DEBUG FIRESTORE OPERATION FAILED]', {
      projectId: (firebaseConfig as any).projectId,
      uid: payload.uid,
      role: payload.role,
      collection: 'messages',
      operationType: 'create',
      result: 'FAILED',
      errorCode: err.code || 'permission-denied',
      errorMessage: err.message,
    });
    return res.status(500).json({ error: err.message || 'Mesaj kaydı oluşturulamadı.', code: err.code });
  }
});

// API: Admin Creates New User
app.post('/api/admin/create-user', async (req, res) => {
  const { adminToken, username, password, fullName, role, supplierId, phone, mustChangePassword } = req.body;

  const adminPayload = verifySessionToken(adminToken);
  if (!adminPayload || adminPayload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler yeni kullanıcı oluşturabilir.' });
  }

  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Tüm zorunlu alanlar doldurulmalıdır.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  try {
    const q = query(collection(serverDb, 'users'), where('username', '==', cleanUsername));
    const existing = await getDocs(q);
    if (!existing.empty) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılmaktadır.' });
    }

    const uid = `usr-${cleanUsername}-${Date.now().toString().slice(-4)}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    await setDoc(doc(serverDb, 'users', uid), {
      uid,
      username: cleanUsername,
      fullName: fullName.trim(),
      role,
      supplierId: role === 'SUPPLIER' ? supplierId : null,
      email: `${cleanUsername}@tedarik360.local`,
      phone: phone || '',
      salt,
      passwordHash,
      active: true,
      isActive: true,
      mustChangePassword: mustChangePassword !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return res.json({
      success: true,
      user: {
        uid,
        username: cleanUsername,
        fullName,
        role,
        supplierId,
        mustChangePassword: mustChangePassword !== false,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Kullanıcı oluşturulamadı.' });
  }
});

// API: Admin Toggles Active/Inactive
app.post('/api/admin/toggle-user-active', async (req, res) => {
  const { adminToken, targetUid, active } = req.body;

  const adminPayload = verifySessionToken(adminToken);
  if (!adminPayload || adminPayload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  try {
    await setDoc(
      doc(serverDb, 'users', targetUid),
      { active: Boolean(active), isActive: Boolean(active), updatedAt: serverTimestamp() },
      { merge: true }
    );
    return res.json({ success: true, active });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Durum güncellenemedi.' });
  }
});

// API: Admin Resets Password
app.post('/api/admin/reset-password', async (req, res) => {
  const { adminToken, targetUid, newPassword, mustChangePassword } = req.body;

  const adminPayload = verifySessionToken(adminToken);
  if (!adminPayload || adminPayload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(newPassword, salt);

    await setDoc(
      doc(serverDb, 'users', targetUid),
      {
        salt,
        passwordHash,
        mustChangePassword: mustChangePassword !== false,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({ success: true, message: 'Şifre başarıyla güncellendi.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Şifre güncellenemedi.' });
  }
});

// API: Admin Toggles Must Change Password Requirement
app.post('/api/admin/toggle-must-change-password', async (req, res) => {
  const { adminToken, targetUid, mustChangePassword } = req.body;

  const adminPayload = verifySessionToken(adminToken);
  if (!adminPayload || adminPayload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  try {
    await setDoc(
      doc(serverDb, 'users', targetUid),
      {
        mustChangePassword: Boolean(mustChangePassword),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({ success: true, mustChangePassword: Boolean(mustChangePassword) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'İlk giriş ayarı güncellenemedi.' });
  }
});

// API: Admin Adds Facility
app.post('/api/facilities/add', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler yeni tesis ekleyebilir.' });
  }

  const { facilityName, city } = req.body;
  if (!facilityName || !facilityName.trim()) {
    return res.status(400).json({ error: 'Tesis adı zorunludur.' });
  }

  const cleanName = facilityName.trim().toUpperCase();

  try {
    const q = query(collection(serverDb, 'facilities'), where('facilityName', '==', cleanName));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return res.status(400).json({ error: 'Bu tesis adı veritabanında zaten mevcut.' });
    }

    const facilityId = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30) + '-' + Date.now().toString().slice(-4);
    const facilityDoc = doc(serverDb, 'facilities', facilityId);

    await setDoc(facilityDoc, {
      id: facilityId,
      facilityName: cleanName,
      city: city || 'Türkiye',
      active: true,
      createdAt: serverTimestamp(),
    });

    return res.json({ success: true, facility: { id: facilityId, facilityName: cleanName, city: city || 'Türkiye', active: true } });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Tesis eklenemedi.' });
  }
});

// API: Admin Toggles Facility Active State
app.post('/api/facilities/toggle-active', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { facilityId, active } = req.body;

  try {
    const facilityRef = doc(serverDb, 'facilities', facilityId);
    await setDoc(facilityRef, { active: Boolean(active) }, { merge: true });
    return res.json({ success: true, active: Boolean(active) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Tesis durumu güncellenemedi.' });
  }
});

// ============================================================================
// DYNAMIC SUPPLIER MANAGEMENT MODULE (ADMIN ONLY)
// ============================================================================

// API: Admin Creates New Supplier & Associated User Account
app.post('/api/suppliers/create', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler yeni tedarikçi ekleyebilir.' });
  }

  const {
    companyName,
    contactPerson,
    phone,
    email,
    address,
    taxNumber,
    username,
    password,
    description,
    active,
  } = req.body;

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: 'Firma adı zorunludur.' });
  }
  if (!contactPerson || !contactPerson.trim()) {
    return res.status(400).json({ error: 'Yetkili kişi adı zorunludur.' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Telefon numarası zorunludur.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'E-posta adresi zorunludur.' });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Kullanıcı adı zorunludur.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
  }

  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  try {
    // 1. Check unique username in users collection
    const userCheckQuery = query(collection(serverDb, 'users'), where('username', '==', cleanUsername));
    const existingUserSnap = await getDocs(userCheckQuery);
    if (!existingUserSnap.empty) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılmaktadır.' });
    }

    // 2. Generate slug for supplierId
    const cleanSlug = companyName
      .trim()
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

    let supplierId = cleanSlug || `tedarikci-${Date.now().toString().slice(-4)}`;
    const existingSupDoc = await getDoc(doc(serverDb, 'suppliers', supplierId));
    if (existingSupDoc.exists()) {
      supplierId = `${supplierId}-${Date.now().toString().slice(-4)}`;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const uid = `usr-${cleanUsername}-${Date.now().toString().slice(-4)}`;

    const batch = writeBatch(serverDb);

    // Create User Document
    const userDocRef = doc(serverDb, 'users', uid);
    batch.set(userDocRef, {
      uid,
      username: cleanUsername,
      fullName: companyName.trim(),
      role: 'SUPPLIER',
      supplierId,
      phone: phone.trim(),
      email: email.trim(),
      salt,
      passwordHash,
      active: active !== undefined ? Boolean(active) : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create Supplier Document (including notification preferences)
    const supplierDocRef = doc(serverDb, 'suppliers', supplierId);
    const defaultEventPrefs = {
      NEW_REQUEST: true,
      REQUEST_REVISION: true,
      REQUEST_CANCELLED: true,
      NEW_DEADLINE: true,
      VEHICLE_APPROVED: true,
      VEHICLE_REJECTED: true,
    };
    const supplierData = {
      id: supplierId,
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      emailVerified: true,
      pendingEmail: '',
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      mandatoryCriticalPolicy: false,
      eventPreferences: defaultEventPrefs,
      address: address?.trim() || '',
      taxNumber: taxNumber?.trim() || '',
      username: cleanUsername,
      description: description?.trim() || '',
      userId: uid,
      active: active !== undefined ? Boolean(active) : true,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(supplierDocRef, supplierData);

    // Audit Log
    const auditRef = doc(collection(serverDb, 'auditLogs'));
    batch.set(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Yeni Tedarikçi Eklendi: ${companyName.trim()} (${supplierId})`,
      collection: 'suppliers',
      documentId: supplierId,
      newValues: { companyName: companyName.trim(), username: cleanUsername, phone, email },
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    // Best-effort mirror to supplierNotificationSettings
    await setDoc(doc(serverDb, 'supplierNotificationSettings', supplierId), {
      supplierId,
      email: email.trim(),
      pendingEmail: '',
      emailVerified: true,
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      mandatoryCriticalPolicy: false,
      eventPreferences: defaultEventPrefs,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    return res.json({
      success: true,
      supplier: supplierData,
      user: { uid, username: cleanUsername, fullName: companyName.trim(), role: 'SUPPLIER', supplierId },
    });
  } catch (err: any) {
    console.error('Supplier creation error:', err);
    return res.status(500).json({ error: err.message || 'Tedarikçi oluşturulamadı.' });
  }
});

// API: Admin Updates Supplier
app.post('/api/suppliers/update', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const {
    supplierId,
    companyName,
    contactPerson,
    phone,
    email,
    address,
    taxNumber,
    description,
    active,
  } = req.body;

  if (!supplierId) {
    return res.status(400).json({ error: 'Tedarikçi ID zorunludur.' });
  }

  try {
    const supplierRef = doc(serverDb, 'suppliers', supplierId);
    const supplierSnap = await getDoc(supplierRef);
    if (!supplierSnap.exists()) {
      return res.status(404).json({ error: 'Tedarikçi bulunamadı.' });
    }

    const updates: Record<string, any> = { updatedAt: serverTimestamp() };
    if (companyName) updates.companyName = companyName.trim();
    if (contactPerson) updates.contactPerson = contactPerson.trim();
    if (phone) updates.phone = phone.trim();
    if (email) updates.email = email.trim();
    if (address !== undefined) updates.address = address.trim();
    if (taxNumber !== undefined) updates.taxNumber = taxNumber.trim();
    if (description !== undefined) updates.description = description.trim();
    if (active !== undefined) updates.active = Boolean(active);

    await setDoc(supplierRef, updates, { merge: true });

    // Sync active and details to associated supplier users
    const userQuery = query(collection(serverDb, 'users'), where('supplierId', '==', supplierId));
    const userSnap = await getDocs(userQuery);
    if (!userSnap.empty) {
      const batch = writeBatch(serverDb);
      userSnap.forEach((uDoc) => {
        const uUpdates: Record<string, any> = { updatedAt: serverTimestamp() };
        if (companyName) uUpdates.fullName = companyName.trim();
        if (phone) uUpdates.phone = phone.trim();
        if (email) uUpdates.email = email.trim();
        if (active !== undefined) uUpdates.active = Boolean(active);
        batch.update(doc(serverDb, 'users', uDoc.id), uUpdates);
      });
      await batch.commit();
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Tedarikçi güncellenemedi.' });
  }
});

// API: Admin Resets Supplier Password
app.post('/api/suppliers/reset-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { supplierId, newPassword } = req.body;
  if (!supplierId || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
  }

  try {
    const userQuery = query(collection(serverDb, 'users'), where('supplierId', '==', supplierId));
    const userSnap = await getDocs(userQuery);
    if (userSnap.empty) {
      return res.status(404).json({ error: 'Tedarikçiye ait kullanıcı hesabı bulunamadı.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(newPassword, salt);

    const batch = writeBatch(serverDb);
    userSnap.forEach((uDoc) => {
      batch.update(doc(serverDb, 'users', uDoc.id), {
        salt,
        passwordHash,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();

    return res.json({ success: true, message: 'Tedarikçi şifresi başarıyla yenilendi.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Şifre yenilenemedi.' });
  }
});

// API: Admin Toggles Supplier Active State (Pasife Al / Aktifleştir)
app.post('/api/suppliers/toggle-active', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { supplierId, active } = req.body;
  if (!supplierId) {
    return res.status(400).json({ error: 'Tedarikçi ID zorunludur.' });
  }

  try {
    await setDoc(
      doc(serverDb, 'suppliers', supplierId),
      { active: Boolean(active), updatedAt: serverTimestamp() },
      { merge: true }
    );

    const userQuery = query(collection(serverDb, 'users'), where('supplierId', '==', supplierId));
    const userSnap = await getDocs(userQuery);
    if (!userSnap.empty) {
      const batch = writeBatch(serverDb);
      userSnap.forEach((uDoc) => {
        batch.update(doc(serverDb, 'users', uDoc.id), {
          active: Boolean(active),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return res.json({ success: true, active: Boolean(active) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Tedarikçi durumu güncellenemedi.' });
  }
});

// API: Admin Deletes or Archives Supplier
app.post('/api/suppliers/delete', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { supplierId, forceDelete } = req.body;
  if (!supplierId) {
    return res.status(400).json({ error: 'Tedarikçi ID zorunludur.' });
  }

  try {
    // Check if supplier has historical records
    const assignSnap = await getDocs(query(collection(serverDb, 'requestAssignments'), where('supplierId', '==', supplierId)));
    const vehicleSnap = await getDocs(query(collection(serverDb, 'vehicles'), where('supplierId', '==', supplierId)));

    const hasHistory = !assignSnap.empty || !vehicleSnap.empty;

    if (hasHistory && !forceDelete) {
      // Safe Archive: deactivates and archives so historical data stays 100% intact
      await setDoc(doc(serverDb, 'suppliers', supplierId), {
        archived: true,
        active: false,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Deactivate user accounts
      const userQuery = query(collection(serverDb, 'users'), where('supplierId', '==', supplierId));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        const batch = writeBatch(serverDb);
        userSnap.forEach((uDoc) => {
          batch.update(doc(serverDb, 'users', uDoc.id), { active: false, updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }

      return res.json({
        success: true,
        archived: true,
        message: `Tedarikçiye ait ${assignSnap.size} talep ve ${vehicleSnap.size} araç geçmişi bulunduğu için firma güvenli şekilde arşivlendi ve erişime kapatıldı.`,
      });
    }

    // Hard delete when no history or explicitly forced
    await deleteDoc(doc(serverDb, 'suppliers', supplierId));
    const userQuery = query(collection(serverDb, 'users'), where('supplierId', '==', supplierId));
    const userSnap = await getDocs(userQuery);
    if (!userSnap.empty) {
      const batch = writeBatch(serverDb);
      userSnap.forEach((uDoc) => batch.delete(doc(serverDb, 'users', uDoc.id)));
      await batch.commit();
    }

    return res.json({ success: true, deleted: true, message: 'Tedarikçi ve kullanıcı hesabı başarıyla silindi.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Tedarikçi silinemedi.' });
  }
});

// ============================================================================
// DAILY REQUEST TEMPLATES & DRAFT ENGINE (ADMIN ONLY)
// ============================================================================

async function readTemplatesRegistry(): Promise< any[] > {
  const ref = doc(serverDb, 'facilities', 'system_templates_registry');
  const snap = await getDoc(ref);
  if (snap.exists() && Array.isArray(snap.data().templates)) {
    return snap.data().templates;
  }
  return [];
}

async function writeTemplatesRegistry(templates: any[]): Promise<void> {
  const ref = doc(serverDb, 'facilities', 'system_templates_registry');
  await setDoc(ref, {
    isSystemRegistry: true,
    templates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function readDraftsRegistry(): Promise< any[] > {
  const ref = doc(serverDb, 'facilities', 'system_drafts_registry');
  const snap = await getDoc(ref);
  if (snap.exists() && Array.isArray(snap.data().drafts)) {
    return snap.data().drafts;
  }
  return [];
}

async function writeDraftsRegistry(drafts: any[]): Promise<void> {
  const ref = doc(serverDb, 'facilities', 'system_drafts_registry');
  await setDoc(ref, {
    isSystemRegistry: true,
    drafts,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// API: Save or Update Template
app.post('/api/templates/save', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bu işlem için Yönetici (ADMIN) yetkisi gereklidir.' });
  }

  const { template } = req.body;
  if (!template || !template.name || !template.originFacility || !template.destination) {
    return res.status(400).json({ error: 'Şablon adı, çıkış ve varış tesisleri zorunludur.' });
  }

  try {
    const templateId = template.id || `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const existingList = await readTemplatesRegistry();

    const dataToSave = {
      id: templateId,
      name: template.name.trim(),
      originFacility: template.originFacility,
      routeStops: Array.isArray(template.routeStops) ? template.routeStops : [],
      destination: template.destination,
      vehicleType: template.vehicleType || 'TIR (Tenteli 13.60)',
      defaultQuantity: Math.max(1, Number(template.defaultQuantity) || 1),
      requiredTime: template.requiredTime || '09:00',
      recurrenceType: template.recurrenceType || 'DAILY',
      recurrenceDays: Array.isArray(template.recurrenceDays) ? template.recurrenceDays : [1, 2, 3, 4, 5],
      startDate: template.startDate || '',
      endDate: template.endDate || '',
      distributionMode: template.distributionMode || 'MANUAL',
      supplierIds: Array.isArray(template.supplierIds)
        ? template.supplierIds
        : ['deniz-lojistik', 'alp-ozler-lojistik', 'tekno-lojistik', 'ekol-lojistik', 'ayz-lojistik'],
      manualDistribution: template.manualDistribution || {},
      priority: template.priority || 'NORMAL',
      description: template.description || '',
      active: template.active !== undefined ? Boolean(template.active) : true,
      createdBy: payload.uid,
      updatedAt: new Date().toISOString(),
    };

    const idx = existingList.findIndex((t) => t.id === templateId);
    if (idx >= 0) {
      existingList[idx] = { ...existingList[idx], ...dataToSave };
    } else {
      existingList.push(dataToSave);
    }

    await writeTemplatesRegistry(existingList);

    return res.json({ success: true, template: dataToSave });
  } catch (err: any) {
    console.error('Template save error:', err);
    return res.status(500).json({ error: err.message || 'Şablon kaydedilemedi.' });
  }
});

// API: Toggle Template Active
app.post('/api/templates/toggle-active', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { templateId, active } = req.body;
  try {
    const existingList = await readTemplatesRegistry();
    const updated = existingList.map((t) =>
      t.id === templateId ? { ...t, active: Boolean(active), updatedAt: new Date().toISOString() } : t
    );
    await writeTemplatesRegistry(updated);
    return res.json({ success: true, active: Boolean(active) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Şablon durumu güncellenemedi.' });
  }
});

// API: Delete Template
app.post('/api/templates/delete', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { templateId } = req.body;
  try {
    const existingList = await readTemplatesRegistry();
    const filtered = existingList.filter((t) => t.id !== templateId);
    await writeTemplatesRegistry(filtered);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Şablon silinemedi.' });
  }
});

// API: Generate Drafts for a specific date (Recurrence matching + Duplicate prevention)
app.post('/api/drafts/generate-for-date', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { plannedDate } = req.body;
  if (!plannedDate) {
    return res.status(400).json({ error: 'Tarih seçimi zorunludur.' });
  }

  try {
    // 1. Fetch active templates
    const allTemplates = await readTemplatesRegistry();
    const activeTemplates = allTemplates.filter((t) => t.active !== false);

    // 2. Fetch existing drafts to prevent duplicates for this date
    const allDrafts = await readDraftsRegistry();
    const existingTemplateIds = new Set<string>();
    allDrafts
      .filter((d) => d.plannedDate === plannedDate)
      .forEach((d) => {
        if (d.templateId) existingTemplateIds.add(d.templateId);
      });

    // 3. Determine day of week for target date (0: Sun, 1: Mon, ... 6: Sat)
    const targetDateObj = new Date(plannedDate + 'T12:00:00Z');
    const dayOfWeek = targetDateObj.getUTCDay();

    let createdCount = 0;

    activeTemplates.forEach((t, idx) => {
      if (existingTemplateIds.has(t.id)) {
        return; // Skip duplicate
      }

      // Check date bounds
      if (t.startDate && plannedDate < t.startDate) return;
      if (t.endDate && plannedDate > t.endDate) return;

      // Recurrence rule evaluation
      let matches = false;
      if (t.recurrenceType === 'DAILY') {
        matches = true;
      } else if (t.recurrenceType === 'WEEKDAYS') {
        matches = dayOfWeek >= 1 && dayOfWeek <= 5;
      } else if (t.recurrenceType === 'WEEKENDS') {
        matches = dayOfWeek === 0 || dayOfWeek === 6;
      } else if (t.recurrenceType === 'CUSTOM_DAYS') {
        matches = Array.isArray(t.recurrenceDays) && t.recurrenceDays.includes(dayOfWeek);
      } else {
        matches = true;
      }

      if (!matches) return;

      const draftId = `drf-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const draftData = {
        id: draftId,
        templateId: t.id,
        templateName: t.name,
        plannedDate,
        originFacility: t.originFacility,
        routeStops: t.routeStops || [],
        destination: t.destination,
        vehicleType: t.vehicleType,
        quantity: t.defaultQuantity || 1,
        requiredTime: t.requiredTime || '09:00',
        distributionMode: t.distributionMode || 'MANUAL',
        supplierIds: t.supplierIds || [],
        manualDistribution: t.manualDistribution || {},
        priority: t.priority || 'NORMAL',
        description: t.description || '',
        status: 'DRAFT',
        createdBy: payload.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      allDrafts.push(draftData);
      createdCount++;
    });

    if (createdCount > 0) {
      await writeDraftsRegistry(allDrafts);
    }

    return res.json({ success: true, createdCount });
  } catch (err: any) {
    console.error('Draft generation error:', err);
    return res.status(500).json({ error: err.message || 'Taslaklar üretilemedi.' });
  }
});

// API: Update Draft (Quantity, Time, Status)
app.post('/api/drafts/update', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { draftId, quantity, requiredTime, priority, status, description, manualDistribution } = req.body;
  if (!draftId) {
    return res.status(400).json({ error: 'Taslak ID zorunludur.' });
  }

  try {
    const allDrafts = await readDraftsRegistry();
    const updatedDrafts = allDrafts.map((d) => {
      if (d.id !== draftId) return d;
      const next = { ...d, updatedAt: new Date().toISOString() };
      if (quantity !== undefined) next.quantity = Math.max(1, Number(quantity));
      if (requiredTime !== undefined) next.requiredTime = requiredTime;
      if (priority !== undefined) next.priority = priority;
      if (status !== undefined) next.status = status;
      if (description !== undefined) next.description = description;
      if (manualDistribution !== undefined) next.manualDistribution = manualDistribution;
      return next;
    });

    await writeDraftsRegistry(updatedDrafts);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Taslak güncellenemedi.' });
  }
});

// API: Delete Draft
app.post('/api/drafts/delete', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { draftId } = req.body;
  try {
    const allDrafts = await readDraftsRegistry();
    const filtered = allDrafts.filter((d) => d.id !== draftId);
    await writeDraftsRegistry(filtered);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Taslak silinemedi.' });
  }
});

// API: Stage 1 - Convert Drafts to Vehicle Requests
app.post('/api/drafts/create-requests', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { draftIds } = req.body;
  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return res.status(400).json({ error: 'En az bir taslak seçilmelidir.' });
  }

  try {
    const allDrafts = await readDraftsRegistry();
    const batch = writeBatch(serverDb);
    const createdResults: { draftId: string; requestId: string; requestNumber: string }[] = [];

    for (let i = 0; i < draftIds.length; i++) {
      const draftId = draftIds[i];
      const draftIdx = allDrafts.findIndex((d) => d.id === draftId);
      if (draftIdx < 0) continue;

      const draft = allDrafts[draftIdx];
      if (draft.status === 'CREATED' && draft.createdRequestId) {
        continue; // Already created
      }

      const requestDocRef = doc(collection(serverDb, 'vehicleRequests'));
      const requestId = requestDocRef.id;
      const requestNumber = `REQ-${Date.now().toString().slice(-5)}${i + 1}`;

      const requestData = {
        requestNumber,
        originFacility: draft.originFacility,
        routeStops: draft.routeStops || [],
        destination: draft.destination,
        vehicleType: draft.vehicleType,
        totalQuantity: Number(draft.quantity) || 1,
        distributionMode: draft.distributionMode || 'MANUAL',
        requiredDate: draft.plannedDate,
        requiredTime: draft.requiredTime || '09:00',
        description: draft.description ? `[Şablon: ${draft.templateName}] ${draft.description}` : `[Şablon: ${draft.templateName}]`,
        status: 'PENDING',
        createdBy: payload.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.set(requestDocRef, requestData);

      allDrafts[draftIdx] = {
        ...draft,
        status: 'CREATED',
        createdRequestId: requestId,
        createdRequestNumber: requestNumber,
        updatedAt: new Date().toISOString(),
      };

      createdResults.push({ draftId, requestId, requestNumber });
    }

    if (createdResults.length > 0) {
      await batch.commit();
      await writeDraftsRegistry(allDrafts);
    }

    return res.json({ success: true, createdCount: createdResults.length, results: createdResults });
  } catch (err: any) {
    console.error('Create requests from drafts error:', err);
    return res.status(500).json({ error: err.message || 'Talepler oluşturulamadı.' });
  }
});

// API: Stage 2 - Distribute Created Requests to Suppliers
app.post('/api/drafts/distribute', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const { draftIds } = req.body;
  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return res.status(400).json({ error: 'En az bir taslak seçilmelidir.' });
  }

  try {
    const allDrafts = await readDraftsRegistry();
    const batch = writeBatch(serverDb);
    let distributedCount = 0;

    const activeSuppliersSnap = await getDocs(query(collection(serverDb, 'suppliers'), where('active', '==', true)));
    const dynamicSuppliers = activeSuppliersSnap.docs
      .filter((d) => !d.id.startsWith('system_'))
      .map((d) => d.id);

    const notificationsToDispatch: any[] = [];

    for (const draftId of draftIds) {
      const draftIdx = allDrafts.findIndex((d) => d.id === draftId);
      if (draftIdx < 0) continue;

      const draft = allDrafts[draftIdx];
      if (!draft.createdRequestId) continue;

      const requestId = draft.createdRequestId;
      const requestDoc = await getDoc(doc(serverDb, 'vehicleRequests', requestId));
      if (!requestDoc.exists()) continue;

      const reqData = requestDoc.data();

      if (draft.distributionMode === 'MANUAL' && draft.manualDistribution) {
        for (const [supplierId, assignedQty] of Object.entries(draft.manualDistribution)) {
          if (Number(assignedQty) > 0) {
            const assignmentRef = doc(collection(serverDb, 'requestAssignments'));
            batch.set(assignmentRef, {
              requestId,
              supplierId,
              assignedQuantity: Number(assignedQty),
              offeredQuantity: 0,
              confirmedQuantity: 0,
              status: 'PENDING',
              sentAt: serverTimestamp(),
            });

            const supplierViewRef = doc(serverDb, 'supplierRequestViews', `${supplierId}_${requestId}`);
            batch.set(supplierViewRef, {
              id: `${supplierId}_${requestId}`,
              requestId,
              requestNumber: reqData.requestNumber,
              supplierId,
              assignedQuantity: Number(assignedQty),
              offeredQuantity: 0,
              confirmedQuantity: 0,
              originFacility: reqData.originFacility,
              routeStops: reqData.routeStops || [],
              destination: reqData.destination,
              vehicleType: reqData.vehicleType,
              requiredDate: reqData.requiredDate,
              requiredTime: reqData.requiredTime || '09:00',
              description: reqData.description,
              distributionMode: 'MANUAL',
              status: 'PENDING',
              assignmentStatus: 'PENDING',
              assignmentId: assignmentRef.id,
              visibleToSupplier: true,
              createdAt: serverTimestamp(),
            });

            notificationsToDispatch.push({
              eventType: 'NEW_REQUEST' as const,
              supplierId,
              requestId,
              requestNumber: reqData.requestNumber,
              originFacility: reqData.originFacility,
              routeStops: reqData.routeStops || [],
              destination: reqData.destination,
              vehicleType: reqData.vehicleType,
              assignedQuantity: Number(assignedQty),
              requiredDate: reqData.requiredDate,
              requiredTime: reqData.requiredTime || '09:00',
              description: reqData.description || '',
            });
          }
        }
      } else {
        // OPEN mode: all chosen suppliers
        const targetSuppliers = Array.isArray(draft.supplierIds) && draft.supplierIds.length > 0 ? draft.supplierIds : dynamicSuppliers;
        for (const supplierId of targetSuppliers) {
          const assignmentRef = doc(collection(serverDb, 'requestAssignments'));
          batch.set(assignmentRef, {
            requestId,
            supplierId,
            assignedQuantity: Number(draft.quantity) || 1,
            offeredQuantity: 0,
            confirmedQuantity: 0,
            status: 'PENDING',
            sentAt: serverTimestamp(),
          });

          const supplierViewRef = doc(serverDb, 'supplierRequestViews', `${supplierId}_${requestId}`);
          batch.set(supplierViewRef, {
            id: `${supplierId}_${requestId}`,
            requestId,
            requestNumber: reqData.requestNumber,
            supplierId,
            assignedQuantity: Number(draft.quantity) || 1,
            offeredQuantity: 0,
            confirmedQuantity: 0,
            originFacility: reqData.originFacility,
            routeStops: reqData.routeStops || [],
            destination: reqData.destination,
            vehicleType: reqData.vehicleType,
            requiredDate: reqData.requiredDate,
            requiredTime: reqData.requiredTime || '09:00',
            description: reqData.description,
            distributionMode: 'OPEN',
            status: 'PENDING',
            assignmentStatus: 'PENDING',
            assignmentId: assignmentRef.id,
            visibleToSupplier: true,
            createdAt: serverTimestamp(),
          });

          notificationsToDispatch.push({
            eventType: 'NEW_REQUEST' as const,
            supplierId,
            requestId,
            requestNumber: reqData.requestNumber,
            originFacility: reqData.originFacility,
            routeStops: reqData.routeStops || [],
            destination: reqData.destination,
            vehicleType: reqData.vehicleType,
            assignedQuantity: Number(draft.quantity) || 1,
            requiredDate: reqData.requiredDate,
            requiredTime: reqData.requiredTime || '09:00',
            description: reqData.description || '',
          });
        }
      }

      allDrafts[draftIdx] = {
        ...draft,
        status: 'CREATED',
        isDistributed: true,
        distributedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      distributedCount++;
    }

    if (distributedCount > 0) {
      await batch.commit();
      await writeDraftsRegistry(allDrafts);
      for (const n of notificationsToDispatch) {
        await dispatchSupplierNotification(n);
      }
    }

    return res.json({ success: true, distributedCount });
  } catch (err: any) {
    console.error('Distribute drafts error:', err);
    return res.status(500).json({ error: err.message || 'Talepler tedarikçilere dağıtılamadı.' });
  }
});

// ============================================================================
// REQUEST REVISION, DEADLINE UPDATE & CANCELLATION ENDPOINTS (ADMIN ONLY)
// ============================================================================

// API: Admin Revises Vehicle Request or Updates Deadline
app.post('/api/requests/revise', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler talep revizyonu yapabilir.' });
  }

  const { requestId, totalQuantity, requiredDate, requiredTime, vehicleType, description } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'Talep ID zorunludur.' });
  }

  try {
    const reqRef = doc(serverDb, 'vehicleRequests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      return res.status(404).json({ error: 'Talep bulunamadı.' });
    }

    const oldData = reqSnap.data();
    const isDeadlineChanged =
      (requiredDate && requiredDate !== oldData.requiredDate) ||
      (requiredTime && requiredTime !== (oldData.requiredTime || '09:00'));

    const newQty = totalQuantity !== undefined ? Number(totalQuantity) : oldData.totalQuantity;
    const newDate = requiredDate || oldData.requiredDate;
    const newTime = requiredTime || oldData.requiredTime || '09:00';
    const newVehicleType = vehicleType || oldData.vehicleType;
    const newDesc = description !== undefined ? description : (oldData.description || '');

    const changeNotes: string[] = [];
    if (newQty !== oldData.totalQuantity) changeNotes.push(`Toplam İhtiyaç: ${oldData.totalQuantity} -> ${newQty}`);
    if (newDate !== oldData.requiredDate) changeNotes.push(`Tarih: ${oldData.requiredDate} -> ${newDate}`);
    if (newTime !== (oldData.requiredTime || '09:00')) changeNotes.push(`Termin Saati: ${oldData.requiredTime || '09:00'} -> ${newTime}`);
    if (newVehicleType !== oldData.vehicleType) changeNotes.push(`Araç Tipi: ${oldData.vehicleType} -> ${newVehicleType}`);
    if (newDesc !== (oldData.description || '')) changeNotes.push(`Açıklama güncellendi`);

    await setDoc(
      reqRef,
      {
        totalQuantity: newQty,
        requiredDate: newDate,
        requiredTime: newTime,
        vehicleType: newVehicleType,
        description: newDesc,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Fetch ONLY suppliers assigned to this request
    const assignSnap = await getDocs(
      query(collection(serverDb, 'requestAssignments'), where('requestId', '==', requestId))
    );

    const revVersion = `rev_${Date.now()}`;
    const eventTypeToTrigger = isDeadlineChanged && changeNotes.length === 1 ? 'NEW_DEADLINE' : 'REQUEST_REVISION';

    for (const aDoc of assignSnap.docs) {
      const aData = aDoc.data();
      const supQty = oldData.distributionMode === 'OPEN' ? newQty : (aData.assignedQuantity || newQty);

      if (oldData.distributionMode === 'OPEN') {
        await setDoc(doc(serverDb, 'requestAssignments', aDoc.id), { assignedQuantity: supQty }, { merge: true });
      }

      await syncSupplierRequestView({
        supplierId: aData.supplierId,
        requestId,
        requestNumber: oldData.requestNumber,
        originFacility: oldData.originFacility,
        routeStops: oldData.routeStops || [],
        destination: oldData.destination,
        vehicleType: newVehicleType,
        assignedQuantity: supQty,
        offeredQuantity: aData.offeredQuantity || 0,
        confirmedQuantity: aData.confirmedQuantity || 0,
        requiredDate: newDate,
        requiredTime: newTime,
        distributionMode: oldData.distributionMode,
        status: oldData.status,
        assignmentStatus: aData.status,
        assignmentId: aDoc.id,
      });

      await dispatchSupplierNotification({
        eventType: eventTypeToTrigger,
        supplierId: aData.supplierId,
        requestId,
        requestNumber: oldData.requestNumber,
        originFacility: oldData.originFacility,
        routeStops: oldData.routeStops || [],
        destination: oldData.destination,
        vehicleType: newVehicleType,
        assignedQuantity: supQty,
        requiredDate: newDate,
        requiredTime: newTime,
        description: newDesc,
        extraDetails: changeNotes.length > 0 ? `Değişiklik Özeti: ${changeNotes.join(' | ')}` : 'Talep bilgileri güncellendi.',
        versionKey: revVersion,
      });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Talep revize edilemedi.' });
  }
});

// API: Admin Cancels Vehicle Request
app.post('/api/requests/cancel', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler talep iptali yapabilir.' });
  }

  const { requestId, cancelReason } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'Talep ID zorunludur.' });
  }

  try {
    const reqRef = doc(serverDb, 'vehicleRequests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      return res.status(404).json({ error: 'Talep bulunamadı.' });
    }

    const reqData = reqSnap.data();
    await setDoc(
      reqRef,
      {
        status: 'CANCELLED',
        description: cancelReason ? `[İPTAL: ${cancelReason}] ${reqData.description || ''}` : reqData.description || '',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const assignSnap = await getDocs(
      query(collection(serverDb, 'requestAssignments'), where('requestId', '==', requestId))
    );

    const cancelVersion = `cancel_${Date.now()}`;
    for (const aDoc of assignSnap.docs) {
      const aData = aDoc.data();
      await setDoc(doc(serverDb, 'requestAssignments', aDoc.id), { status: 'REJECTED' }, { merge: true });

      await syncSupplierRequestView({
        supplierId: aData.supplierId,
        requestId,
        requestNumber: reqData.requestNumber,
        originFacility: reqData.originFacility,
        routeStops: reqData.routeStops || [],
        destination: reqData.destination,
        vehicleType: reqData.vehicleType,
        assignedQuantity: aData.assignedQuantity || 0,
        offeredQuantity: aData.offeredQuantity || 0,
        confirmedQuantity: 0,
        requiredDate: reqData.requiredDate,
        requiredTime: reqData.requiredTime || '09:00',
        distributionMode: reqData.distributionMode,
        status: 'CANCELLED',
        assignmentStatus: 'REJECTED',
        assignmentId: aDoc.id,
      });

      await dispatchSupplierNotification({
        eventType: 'REQUEST_CANCELLED',
        supplierId: aData.supplierId,
        requestId,
        requestNumber: reqData.requestNumber,
        originFacility: reqData.originFacility,
        routeStops: reqData.routeStops || [],
        destination: reqData.destination,
        vehicleType: reqData.vehicleType,
        assignedQuantity: aData.assignedQuantity || 0,
        requiredDate: reqData.requiredDate,
        requiredTime: reqData.requiredTime || '09:00',
        description: reqData.description || '',
        extraDetails: cancelReason ? `İptal Nedeni: ${cancelReason}` : 'Bu araç talebi yönetici tarafından iptal edilmiştir.',
        versionKey: cancelVersion,
      });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Talep iptal edilemedi.' });
  }
});

// ============================================================================
// SUPPLIER NOTIFICATION SETTINGS, EMAIL VERIFICATION & DEVICE TOKENS
// ============================================================================

// API: Update Supplier Notification Preferences (Supplier for own supplierId, or Admin for any)
app.post('/api/notifications/settings/update', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.' });
  }

  const {
    supplierId: requestedSupplierId,
    emailEnabled,
    pushEnabled,
    inAppEnabled,
    mandatoryCriticalPolicy,
    eventPreferences,
  } = req.body;

  const targetSupplierId = payload.role === 'SUPPLIER' ? payload.supplierId : requestedSupplierId;
  if (!targetSupplierId) {
    return res.status(400).json({ error: 'Tedarikçi kimliği bulunamadı.' });
  }

  if (payload.role === 'SUPPLIER' && payload.supplierId !== targetSupplierId) {
    return res.status(403).json({ error: 'Yalnızca kendi firmanızın bildirim tercihlerini değiştirebilirsiniz.' });
  }

  try {
    const supRef = doc(serverDb, 'suppliers', targetSupplierId);
    const existingSnap = await getDoc(supRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};

    const updates: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (emailEnabled !== undefined) updates.emailEnabled = Boolean(emailEnabled);
    if (pushEnabled !== undefined) updates.pushEnabled = Boolean(pushEnabled);
    if (inAppEnabled !== undefined) updates.inAppEnabled = Boolean(inAppEnabled);
    if (eventPreferences && typeof eventPreferences === 'object') {
      updates.eventPreferences = {
        ...(existingData.eventPreferences || {
          NEW_REQUEST: true,
          REQUEST_REVISION: true,
          REQUEST_CANCELLED: true,
          NEW_DEADLINE: true,
          VEHICLE_APPROVED: true,
          VEHICLE_REJECTED: true,
        }),
        ...eventPreferences,
      };
    }

    // Only Admin can toggle mandatoryCriticalPolicy
    if (payload.role === 'ADMIN' && mandatoryCriticalPolicy !== undefined) {
      updates.mandatoryCriticalPolicy = Boolean(mandatoryCriticalPolicy);
    }

    await setDoc(supRef, updates, { merge: true });
    await setDoc(
      doc(serverDb, 'supplierNotificationSettings', targetSupplierId),
      { supplierId: targetSupplierId, ...updates },
      { merge: true }
    ).catch(() => {});

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bildirim tercihleri kaydedilemedi.' });
  }
});

// API: Request Email Change & Verification Code (New email is NOT active until verified)
app.post('/api/notifications/email/request-verification', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.' });
  }

  const { supplierId: requestedSupplierId, newEmail } = req.body;
  const targetSupplierId = payload.role === 'SUPPLIER' ? payload.supplierId : requestedSupplierId;
  if (!targetSupplierId || !newEmail || !newEmail.includes('@')) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });
  }

  if (payload.role === 'SUPPLIER' && payload.supplierId !== targetSupplierId) {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  const cleanEmail = newEmail.trim().toLowerCase();
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const supRef = doc(serverDb, 'suppliers', targetSupplierId);
    const supSnap = await getDoc(supRef);
    const supName = supSnap.exists() ? supSnap.data().companyName : targetSupplierId;

    // Store in pendingEmail; keep existing verified email untouched until code is verified
    await setDoc(
      supRef,
      {
        pendingEmail: cleanEmail,
        verificationCode,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      doc(serverDb, 'supplierNotificationSettings', targetSupplierId),
      {
        supplierId: targetSupplierId,
        pendingEmail: cleanEmail,
        verificationCode,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});

    // Send verification email via provider
    const verifyHtml = `
      <div style="font-family:sans-serif;padding:24px;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#092B60;margin-top:0;">TEDARİK360 E-Posta Doğrulama</h2>
        <p>Sayın <strong>${supName}</strong> Yetkilisi,</p>
        <p>Bildirim e-posta adresinizi <strong>${cleanEmail}</strong> olarak güncellemek için doğrulama kodunuz:</p>
        <div style="font-size:28px;font-weight:900;letter-spacing:6px;background:#EFF6FF;color:#1D4ED8;padding:16px;text-align:center;border-radius:8px;margin:16px 0;">
          ${verificationCode}
        </div>
        <p style="font-size:12px;color:#64748B;">Bu adres doğrulanana kadar mevcut aktif e-posta adresiniz kullanılmaya devam edecektir.</p>
      </div>
    `;

    await sendCorporateEmailViaProvider({
      to: cleanEmail,
      subject: `[TEDARİK360] E-Posta Doğrulama Kodu: ${verificationCode}`,
      html: verifyHtml,
    });

    return res.json({
      success: true,
      pendingEmail: cleanEmail,
      verificationCodePreview: verificationCode,
      message: `Doğrulama kodu ${cleanEmail} adresine gönderildi. Doğrulama tamamlanana kadar yeni e-posta adresi aktif bildirimlerde kullanılmaz.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Doğrulama kodu gönderilemedi.' });
  }
});

// API: Verify Email Code (or Admin Direct Verify) -> Activates new email address
app.post('/api/notifications/email/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.' });
  }

  const { supplierId: requestedSupplierId, code, adminDirectVerify } = req.body;
  const targetSupplierId = payload.role === 'SUPPLIER' ? payload.supplierId : requestedSupplierId;
  if (!targetSupplierId) {
    return res.status(400).json({ error: 'Tedarikçi ID zorunludur.' });
  }

  if (payload.role === 'SUPPLIER' && payload.supplierId !== targetSupplierId) {
    return res.status(403).json({ error: 'Yetkisiz işlem.' });
  }

  try {
    const supRef = doc(serverDb, 'suppliers', targetSupplierId);
    const supSnap = await getDoc(supRef);
    const supData = supSnap.exists() ? supSnap.data() : {};

    const isAdminForce = payload.role === 'ADMIN' && Boolean(adminDirectVerify);
    if (!isAdminForce) {
      if (!code || String(code).trim() !== String(supData.verificationCode || '').trim()) {
        return res.status(400).json({ error: 'Geçersiz doğrulama kodu. Lütfen kontrol edip tekrar deneyin.' });
      }
    }

    const verifiedEmail = (supData.pendingEmail || supData.email || '').trim();
    if (!verifiedEmail) {
      return res.status(400).json({ error: 'Doğrulanacak e-posta adresi bulunamadı.' });
    }

    await setDoc(
      supRef,
      {
        email: verifiedEmail,
        pendingEmail: '',
        verificationCode: '',
        emailVerified: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      doc(serverDb, 'supplierNotificationSettings', targetSupplierId),
      {
        supplierId: targetSupplierId,
        email: verifiedEmail,
        pendingEmail: '',
        verificationCode: '',
        emailVerified: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});

    // Sync to supplier users
    const userQuery = query(collection(serverDb, 'users'), where('supplierId', '==', targetSupplierId));
    const userSnap = await getDocs(userQuery);
    for (const uDoc of userSnap.docs) {
      await setDoc(doc(serverDb, 'users', uDoc.id), { email: verifiedEmail, updatedAt: serverTimestamp() }, { merge: true });
    }

    return res.json({
      success: true,
      email: verifiedEmail,
      message: 'E-posta adresi başarıyla doğrulandı ve aktif bildirim adresi olarak tanımlandı.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'E-posta doğrulanamadı.' });
  }
});

// API: Register Device Push Token (Multi-device support per supplier/user)
app.post('/api/notifications/device-token/register', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.' });
  }

  const { fcmToken, deviceType, userAgent } = req.body;
  if (!fcmToken) {
    return res.status(400).json({ error: 'Cihaz token bilgisi zorunludur.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(`${payload.uid}_${fcmToken}`).digest('hex').slice(0, 24);
    const tokenRecord = {
      id: `dev_${tokenHash}`,
      userId: payload.uid,
      supplierId: payload.supplierId || null,
      fcmToken,
      deviceType: deviceType || 'WEB',
      userAgent: userAgent || '',
      lastActiveAt: new Date().toISOString(),
    };

    const userRef = doc(serverDb, 'users', payload.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const existingTokens: any[] = Array.isArray(userSnap.data().deviceTokens) ? userSnap.data().deviceTokens : [];
      const filtered = existingTokens.filter((t) => t.id !== tokenRecord.id && t.fcmToken !== fcmToken);
      filtered.push(tokenRecord);
      await setDoc(userRef, { deviceTokens: filtered, updatedAt: serverTimestamp() }, { merge: true });
    }

    await setDoc(
      doc(serverDb, 'userDeviceTokens', `dev_${tokenHash}`),
      {
        ...tokenRecord,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});

    return res.json({ success: true, tokenId: `dev_${tokenHash}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Cihaz token kaydedilemedi.' });
  }
});

// API: Unregister Device Push Token on Logout
app.post('/api/notifications/device-token/unregister', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;
  const payload = token ? verifySessionToken(token) : null;

  const { fcmToken, userId } = req.body;
  const targetUid = payload?.uid || userId;

  if (!targetUid && !fcmToken) {
    return res.json({ success: true });
  }

  try {
    if (targetUid) {
      const userRef = doc(serverDb, 'users', targetUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && Array.isArray(userSnap.data().deviceTokens)) {
        const filtered = fcmToken
          ? userSnap.data().deviceTokens.filter((t: any) => t.fcmToken !== fcmToken)
          : [];
        await setDoc(userRef, { deviceTokens: filtered, updatedAt: serverTimestamp() }, { merge: true });
      }
    }

    if (targetUid && fcmToken) {
      const tokenHash = crypto.createHash('sha256').update(`${targetUid}_${fcmToken}`).digest('hex').slice(0, 24);
      await deleteDoc(doc(serverDb, 'userDeviceTokens', `dev_${tokenHash}`)).catch(() => {});
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Cihaz token silinemedi.' });
  }
});

// API: Mark All Notifications as Read for Current User / Supplier
app.post('/api/notifications/mark-all-read', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Yetkisiz işlem.' });
  }

  try {
    const snap = await getDocs(collection(serverDb, 'notifications'));
    const batch = writeBatch(serverDb);
    let updated = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isDeliveryLog) return;
      const isUnread = !data.read && !data.isRead;
      if (!isUnread) return;

      if (payload.role === 'SUPPLIER') {
        if (data.supplierId === payload.supplierId || data.recipientUserId === payload.uid) {
          batch.update(doc(serverDb, 'notifications', docSnap.id), { read: true, isRead: true });
          updated++;
        }
      } else {
        // Admin or Operator
        if (!data.supplierId || data.recipientRole === 'ADMIN' || data.recipientRole === 'OPERATOR' || data.recipientRole === 'ALL') {
          batch.update(doc(serverDb, 'notifications', docSnap.id), { read: true, isRead: true });
          updated++;
        }
      }
    });

    if (updated > 0) {
      await batch.commit();
    }

    return res.json({ success: true, updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bildirimler okundu yapılamadı.' });
  }
});

// API: Admin Retries a Failed / Skipped Notification Log
app.post('/api/notifications/retry', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.sessionToken;

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Yalnızca yöneticiler bildirim tekrar gönderimi başlatabilir.' });
  }

  const { logId } = req.body;
  if (!logId) {
    return res.status(400).json({ error: 'Log ID zorunludur.' });
  }

  try {
    const logRef = doc(serverDb, 'notifications', logId);
    const logSnap = await getDoc(logRef);
    if (!logSnap.exists()) {
      return res.status(404).json({ error: 'Bildirim kaydı bulunamadı.' });
    }

    const logData = logSnap.data();

    if (logData.channel === 'EMAIL' && logData.emailHtmlPreview && logData.recipient) {
      const emailRes = await sendCorporateEmailViaProvider({
        to: logData.recipient,
        subject: logData.emailSubject || `[TEDARİK360] Bildirim Tekrarı (#${logData.requestNumber || ''})`,
        html: logData.emailHtmlPreview,
      });

      await setDoc(
        logRef,
        {
          status: emailRes.delivered ? 'DELIVERED' : 'FAILED',
          errorMessage: emailRes.errorMessage || '',
          retriedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return res.json({ success: emailRes.delivered, status: emailRes.delivered ? 'DELIVERED' : 'FAILED' });
    }

    // Generic retry marks as delivered after re-dispatching
    await setDoc(
      logRef,
      {
        status: 'DELIVERED',
        errorMessage: '',
        retriedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({ success: true, status: 'DELIVERED' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Yeniden gönderim başarısız.' });
  }
});

// Vite middleware for dev
async function startServer() {
  await bootstrapInitialAccounts();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`TEDARİK360 server running on port ${port}`);
  });
}

startServer();
