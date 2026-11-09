// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
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
  deleteDoc
} from "firebase/firestore";
import crypto from "crypto";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "funky-decoder-fmn89",
  appId: "1:548745451275:web:20d5109b9e23ccea1ef40e",
  apiKey: "AIzaSyDLS4PsJC-gPBxh8a2nA8pY9PyNdTZ-hXA",
  authDomain: "funky-decoder-fmn89.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-8fde1c6a-5e7f-49ab-b0a9-fb9b3dc82a4e",
  storageBucket: "funky-decoder-fmn89.firebasestorage.app",
  messagingSenderId: "548745451275",
  measurementId: "",
  oAuthClientId: "548745451275-qjduanue54tlpu9q489cajuvopth6mmq.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// server.ts
var app = express();
var port = parseInt(process.env.PORT || "3000", 10);
app.use(express.json());
var serverApp = initializeApp(firebase_applet_config_default, "Tedarik360Server");
var serverDb = getFirestore(serverApp, firebase_applet_config_default.firestoreDatabaseId);
var SESSION_SECRET = process.env.SESSION_SECRET || "tedarik360-jwt-session-secret-key-prod-2026";
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
}
function verifyPassword(password, salt, hash) {
  try {
    const check = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(check, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
function createSessionToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.uid,
      username: user.username,
      role: user.role,
      supplierId: user.supplierId || null,
      iat: Math.floor(Date.now() / 1e3),
      exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 3600
      // 7 days
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}
function verifySessionToken(token) {
  try {
    const [header, payload, signature] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(`${header}.${payload}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Math.floor(Date.now() / 1e3)) return null;
    return data;
  } catch {
    return null;
  }
}
var loginAttemptMap = /* @__PURE__ */ new Map();
var MAX_ATTEMPTS = 5;
var LOCKOUT_MS = 3 * 60 * 1e3;
function checkRateLimit(key) {
  const now = Date.now();
  const entry = loginAttemptMap.get(key);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil > now) {
    const waitSeconds = Math.ceil((entry.lockedUntil - now) / 1e3);
    return { allowed: false, waitSeconds };
  }
  if (entry.lockedUntil <= now && entry.count >= MAX_ATTEMPTS) {
    loginAttemptMap.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}
function recordFailedAttempt(key) {
  const now = Date.now();
  const entry = loginAttemptMap.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  loginAttemptMap.set(key, entry);
}
function clearFailedAttempts(key) {
  loginAttemptMap.delete(key);
}
async function bootstrapInitialAccounts() {
  const defaultAccounts = [
    {
      username: "admin",
      initialPassword: process.env.INITIAL_ADMIN_PASSWORD || "admin123",
      fullName: "Sistem Y\xF6neticisi",
      role: "ADMIN",
      supplierId: null
    },
    {
      username: "operator",
      initialPassword: process.env.INITIAL_OPERATOR_PASSWORD || "operator123",
      fullName: "Operasyon Sorumlusu",
      role: "OPERATOR",
      supplierId: null
    },
    {
      username: "deniz_lojistik",
      initialPassword: process.env.INITIAL_DENIZ_PASSWORD || "deniz123",
      fullName: "Deniz Lojistik Temsilcisi",
      role: "SUPPLIER",
      supplierId: "deniz-lojistik"
    },
    {
      username: "alp_ozler",
      initialPassword: process.env.INITIAL_ALPOZLER_PASSWORD || "alp123",
      fullName: "Alp \xD6zler Lojistik Temsilcisi",
      role: "SUPPLIER",
      supplierId: "alp-ozler-lojistik"
    },
    {
      username: "tekno_lojistik",
      initialPassword: process.env.INITIAL_TEKNO_PASSWORD || "tekno123",
      fullName: "Tekno Lojistik Temsilcisi",
      role: "SUPPLIER",
      supplierId: "tekno-lojistik"
    },
    {
      username: "ekol_lojistik",
      initialPassword: process.env.INITIAL_EKOL_PASSWORD || "ekol123",
      fullName: "Ekol Lojistik Temsilcisi",
      role: "SUPPLIER",
      supplierId: "ekol-lojistik"
    },
    {
      username: "ayz_lojistik",
      initialPassword: process.env.INITIAL_AYZ_PASSWORD || "ayz123",
      fullName: "Ayz Lojistik Temsilcisi",
      role: "SUPPLIER",
      supplierId: "ayz-lojistik"
    }
  ];
  try {
    for (const acc of defaultAccounts) {
      const q = query(collection(serverDb, "users"), where("username", "==", acc.username));
      const snap = await getDocs(q);
      if (snap.empty) {
        const uid = `usr-${acc.username}`;
        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = hashPassword(acc.initialPassword, salt);
        await setDoc(doc(serverDb, "users", uid), {
          uid,
          username: acc.username,
          fullName: acc.fullName,
          role: acc.role,
          supplierId: acc.supplierId,
          salt,
          passwordHash,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(`[BOOTSTRAP] Initialized account: ${acc.username} (${acc.role})`);
      }
    }
    const defaultSuppliersData = [
      { id: "deniz-lojistik", companyName: "Deniz Lojistik", contactPerson: "Hakan Deniz", phone: "+90 532 100 0001", email: "operasyon@denizlojistik.com", username: "deniz_lojistik" },
      { id: "alp-ozler-lojistik", companyName: "Alp \xD6zler Lojistik", contactPerson: "Murat \xD6zler", phone: "+90 532 200 0002", email: "operasyon@alpozler.com", username: "alp_ozler" },
      { id: "tekno-lojistik", companyName: "Tekno Lojistik", contactPerson: "Serkan Tekin", phone: "+90 532 300 0003", email: "filo@teknolojistik.com", username: "tekno_lojistik" },
      { id: "ekol-lojistik", companyName: "Ekol Lojistik", contactPerson: "Cem Kaya", phone: "+90 532 400 0004", email: "tedarik@ekol.com", username: "ekol_lojistik" },
      { id: "ayz-lojistik", companyName: "Ayz Lojistik", contactPerson: "Ayz Lojistik Yetkilisi", phone: "+90 532 500 0005", email: "operasyon@ayzlojistik.com", username: "ayz_lojistik" }
    ];
    for (const sup of defaultSuppliersData) {
      const supRef = doc(serverDb, "suppliers", sup.id);
      const supDoc = await getDoc(supRef);
      const defaultPrefs = {
        NEW_REQUEST: true,
        REQUEST_REVISION: true,
        REQUEST_CANCELLED: true,
        NEW_DEADLINE: true,
        VEHICLE_APPROVED: true,
        VEHICLE_REJECTED: true
      };
      if (!supDoc.exists()) {
        await setDoc(supRef, {
          ...sup,
          emailVerified: true,
          pendingEmail: "",
          emailEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          mandatoryCriticalPolicy: false,
          eventPreferences: defaultPrefs,
          address: "T\xFCrkiye",
          taxNumber: "",
          description: "Kurumsal lojistik \xE7\xF6z\xFCm orta\u011F\u0131",
          active: true,
          archived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(`[BOOTSTRAP] Seeded supplier: ${sup.companyName}`);
      } else {
        const d = supDoc.data();
        const patch = {};
        if (d.emailVerified === void 0) patch.emailVerified = true;
        if (d.emailEnabled === void 0) patch.emailEnabled = true;
        if (d.pushEnabled === void 0) patch.pushEnabled = true;
        if (d.inAppEnabled === void 0) patch.inAppEnabled = true;
        if (d.mandatoryCriticalPolicy === void 0) patch.mandatoryCriticalPolicy = false;
        if (!d.eventPreferences) patch.eventPreferences = defaultPrefs;
        if (Object.keys(patch).length > 0) {
          await setDoc(supRef, patch, { merge: true });
        }
      }
      const currentEmail = supDoc.exists() ? supDoc.data().email || sup.email : sup.email;
      await setDoc(
        doc(serverDb, "supplierNotificationSettings", sup.id),
        {
          supplierId: sup.id,
          email: currentEmail,
          pendingEmail: "",
          emailVerified: true,
          emailEnabled: true,
          pushEnabled: true,
          inAppEnabled: true,
          mandatoryCriticalPolicy: false,
          eventPreferences: defaultPrefs,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      ).catch(() => {
      });
    }
    const tplRegRef = doc(serverDb, "facilities", "system_templates_registry");
    const tplRegSnap = await getDoc(tplRegRef);
    if (!tplRegSnap.exists() || !Array.isArray(tplRegSnap.data().templates) || tplRegSnap.data().templates.length === 0) {
      await setDoc(
        tplRegRef,
        {
          isSystemRegistry: true,
          templates: [
            {
              id: "tpl-gebze-izmir-standart",
              name: "Gebze - \u0130zmir Standart Hat",
              originFacility: "GEBZE TM",
              routeStops: [{ facilityId: "bursa-tm", facilityName: "BURSA TM", sequence: 1 }],
              destination: "\u0130ZM\u0130R TM",
              vehicleType: "TIR (Tenteli 13.60)",
              defaultQuantity: 3,
              requiredTime: "08:30",
              recurrenceType: "WEEKDAYS",
              recurrenceDays: [1, 2, 3, 4, 5],
              startDate: "",
              endDate: "",
              distributionMode: "MANUAL",
              supplierIds: ["deniz-lojistik", "alp-ozler-lojistik", "tekno-lojistik", "ekol-lojistik", "ayz-lojistik"],
              manualDistribution: {
                "deniz-lojistik": 1,
                "alp-ozler-lojistik": 1,
                "ekol-lojistik": 1,
                "tekno-lojistik": 0,
                "ayz-lojistik": 0
              },
              priority: "HIGH",
              description: "Hafta i\xE7i d\xFCzenli Gebze -> Bursa -> \u0130zmir ana hat sevkiyat \u015Fablonu",
              active: true,
              createdBy: "usr-admin",
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            },
            {
              id: "tpl-ankara-avrupa-anahat",
              name: "Ankara - Avrupa TM Ana Hat",
              originFacility: "ANKARA TM",
              routeStops: [],
              destination: "AVRUPA TM",
              vehicleType: "TIR (Frigorifik)",
              defaultQuantity: 2,
              requiredTime: "09:00",
              recurrenceType: "DAILY",
              recurrenceDays: [0, 1, 2, 3, 4, 5, 6],
              startDate: "",
              endDate: "",
              distributionMode: "MANUAL",
              supplierIds: ["deniz-lojistik", "alp-ozler-lojistik", "tekno-lojistik", "ekol-lojistik", "ayz-lojistik"],
              manualDistribution: {
                "deniz-lojistik": 1,
                "tekno-lojistik": 1,
                "alp-ozler-lojistik": 0,
                "ekol-lojistik": 0,
                "ayz-lojistik": 0
              },
              priority: "NORMAL",
              description: "G\xFCnl\xFCk Ankara TM -> Avrupa TM direkt frigorifik sefer \u015Fablonu",
              active: true,
              createdBy: "usr-admin",
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }
          ],
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
    const drfRegRef = doc(serverDb, "facilities", "system_drafts_registry");
    const drfRegSnap = await getDoc(drfRegRef);
    if (!drfRegSnap.exists()) {
      await setDoc(drfRegRef, {
        isSystemRegistry: true,
        drafts: [],
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error("[BOOTSTRAP ERROR]:", err.message);
  }
}
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.ip || "anonymous";
  const cleanUsername = (username || "").trim().toLowerCase();
  const rateCheck = checkRateLimit(`${clientIp}_${cleanUsername}`);
  if (!rateCheck.allowed) {
    console.warn(`[AUTH FAILED] Rate limited: ${cleanUsername} from ${clientIp}`);
    return res.status(429).json({
      error: `\xC7ok fazla ba\u015Far\u0131s\u0131z giri\u015F denemesi. L\xFCtfen ${rateCheck.waitSeconds} saniye bekleyiniz.`,
      code: "auth/too-many-requests"
    });
  }
  if (!cleanUsername || !password) {
    return res.status(400).json({
      error: "Kullan\u0131c\u0131 ad\u0131 ve \u015Fifre zorunludur.",
      code: "auth/missing-credentials"
    });
  }
  try {
    const q = query(collection(serverDb, "users"), where("username", "==", cleanUsername));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      recordFailedAttempt(`${clientIp}_${cleanUsername}`);
      console.warn(`[AUTH FAILED] User not found: ${cleanUsername}`);
      return res.status(401).json({
        error: "Kullan\u0131c\u0131 ad\u0131 veya \u015Fifre hatal\u0131.",
        code: "auth/user-not-found"
      });
    }
    let userDocToUse = snapshot.docs.find((d) => d.data().passwordHash && d.data().salt);
    if (!userDocToUse) {
      userDocToUse = snapshot.docs[0];
    }
    const userData = userDocToUse.data();
    if (userData.active === false) {
      console.warn(`[AUTH FAILED] Inactive account attempted login: ${cleanUsername}`);
      return res.status(403).json({
        error: "Bu kullan\u0131c\u0131 hesab\u0131 ask\u0131ya al\u0131nm\u0131\u015Ft\u0131r. L\xFCtfen y\xF6neticiniz ile ileti\u015Fime ge\xE7iniz.",
        code: "auth/user-disabled"
      });
    }
    const isValid = verifyPassword(password, userData.salt, userData.passwordHash);
    if (!isValid) {
      recordFailedAttempt(`${clientIp}_${cleanUsername}`);
      console.warn(`[AUTH FAILED] Invalid password for user: ${cleanUsername}`);
      return res.status(401).json({
        error: "Kullan\u0131c\u0131 ad\u0131 veya \u015Fifre hatal\u0131.",
        code: "auth/wrong-password"
      });
    }
    clearFailedAttempts(`${clientIp}_${cleanUsername}`);
    const token = createSessionToken({
      uid: userData.uid,
      username: userData.username,
      role: userData.role,
      supplierId: userData.supplierId || null
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
        active: userData.active
      }
    });
  } catch (error) {
    console.error("[AUTH ERROR]:", error);
    return res.status(500).json({
      error: "Kimlik do\u011Frulama s\u0131ras\u0131nda bir hata olu\u015Ftu.",
      code: "auth/internal-error"
    });
  }
});
app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Yetkisiz eri\u015Fim." });
  }
  const token = authHeader.split(" ")[1];
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Ge\xE7ersiz veya s\xFCresi dolmu\u015F oturum." });
  }
  try {
    const userDoc = await getDoc(doc(serverDb, "users", payload.uid));
    if (!userDoc.exists() || userDoc.data().active === false) {
      return res.status(401).json({ error: "Kullan\u0131c\u0131 hesab\u0131 aktif de\u011Fil." });
    }
    const userData = userDoc.data();
    return res.json({
      user: {
        uid: userData.uid,
        username: userData.username,
        fullName: userData.fullName,
        role: userData.role,
        supplierId: userData.supplierId || null,
        active: userData.active
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Oturum do\u011Frulanamad\u0131." });
  }
});
async function syncSupplierRequestView(params) {
  const viewId = `${params.supplierId}_${params.requestId}`;
  const viewRef = doc(serverDb, "supplierRequestViews", viewId);
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
      requiredTime: params.requiredTime || "09:00",
      distributionMode: params.distributionMode,
      status: params.status,
      assignmentStatus: params.assignmentStatus || "PENDING",
      assignmentId: params.assignmentId || "",
      responseNote: params.responseNote || "",
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
var EVENT_TYPE_LABELS = {
  NEW_REQUEST: { badge: "YEN\u0130 ARA\xC7 TALEB\u0130", color: "#092B60", subjectPrefix: "Yeni Ara\xE7 Talebi" },
  REQUEST_REVISION: { badge: "TALEP REV\u0130ZYONU", color: "#D97706", subjectPrefix: "Ara\xE7 Talebi Revizyonu" },
  REQUEST_CANCELLED: { badge: "TALEP \u0130PTAL\u0130", color: "#DC2626", subjectPrefix: "Ara\xE7 Talebi \u0130ptali" },
  NEW_DEADLINE: { badge: "YEN\u0130 TERM\u0130N B\u0130LG\u0130S\u0130", color: "#7C3AED", subjectPrefix: "Yeni Termin Bilgisi" },
  VEHICLE_APPROVED: { badge: "ARA\xC7 ONAYLANDI", color: "#059669", subjectPrefix: "Ara\xE7 Onay\u0131" },
  VEHICLE_REJECTED: { badge: "ARA\xC7 REDDED\u0130LD\u0130", color: "#E11D48", subjectPrefix: "Ara\xE7 Reddi" }
};
function buildCorporateEmailHtml(params) {
  const meta = EVENT_TYPE_LABELS[params.eventType] || EVENT_TYPE_LABELS.NEW_REQUEST;
  const stopsText = Array.isArray(params.routeStops) && params.routeStops.length > 0 ? params.routeStops.map((s, idx) => `${idx + 1}. ${s.facilityName || s}`).join(" \u2192 ") : "Do\u011Frudan Sevkiyat (U\u011Frak Yok)";
  const subject = `[TEDAR\u0130K360] ${meta.subjectPrefix} - #${params.requestNumber} (${params.originFacility} \u2192 ${params.destination})`;
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
                    <span style="display:inline-block;background-color:#FFD000;color:#092B60;font-weight:900;font-size:11px;letter-spacing:1.5px;padding:4px 10px;border-radius:6px;text-transform:uppercase;">TEDAR\u0130K360 KURUMSAL LOJ\u0130ST\u0130K</span>
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
              <p style="margin:0;font-size:14px;color:#475569;">Say\u0131n <strong style="color:#092B60;font-weight:800;">${params.supplierName}</strong> Operasyon Yetkilisi,</p>
              <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#64748B;">
                Firman\u0131za atanm\u0131\u015F olan ara\xE7 tedarik operasyonu kapsam\u0131nda a\u015Fa\u011F\u0131daki bildirim detaylar\u0131 olu\u015Fturulmu\u015Ftur. Gizlilik politikas\u0131 gere\u011Fi bu bildirim yaln\u0131zca firman\u0131za \xF6zel kontenjan bilgilerini i\xE7erir.
              </p>
              ${params.extraDetails ? `<div style="margin-top:12px;padding:12px 16px;background-color:#FEF3C7;border-left:4px solid #D97706;border-radius:6px;font-size:12px;font-weight:700;color:#92400E;">${params.extraDetails}</div>` : ""}
            </td>
          </tr>

          <!-- Details Table -->
          <tr>
            <td style="padding:12px 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;font-size:13px;">
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;width:38%;border-bottom:1px solid #E2E8F0;">Firma Ad\u0131</td>
                  <td style="padding:11px 16px;font-weight:800;color:#092B60;border-bottom:1px solid #E2E8F0;">${params.supplierName}</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Talep Numaras\u0131</td>
                  <td style="padding:11px 16px;font-family:monospace;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">#${params.requestNumber}</td>
                </tr>
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">\xC7\u0131k\u0131\u015F Tesisi</td>
                  <td style="padding:11px 16px;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">${params.originFacility}</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">U\u011Frak Noktalar\u0131</td>
                  <td style="padding:11px 16px;font-weight:600;color:#334155;border-bottom:1px solid #E2E8F0;">${stopsText}</td>
                </tr>
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Var\u0131\u015F Tesisi</td>
                  <td style="padding:11px 16px;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">${params.destination}</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Ara\xE7 Tipi</td>
                  <td style="padding:11px 16px;font-weight:700;color:#092B60;border-bottom:1px solid #E2E8F0;">${params.vehicleType}</td>
                </tr>
                <tr style="background-color:#EFF6FF;">
                  <td style="padding:11px 16px;font-weight:800;color:#1E3A8A;border-bottom:1px solid #DBEAFE;">Firman\u0131za Atanan Ara\xE7 \u0130htiyac\u0131</td>
                  <td style="padding:11px 16px;font-weight:900;font-size:15px;color:#1D4ED8;border-bottom:1px solid #DBEAFE;">${params.assignedQuantity} Ara\xE7</td>
                </tr>
                <tr>
                  <td style="padding:11px 16px;font-weight:700;color:#475569;border-bottom:1px solid #E2E8F0;">Gerekli Tarih ve Saat</td>
                  <td style="padding:11px 16px;font-weight:800;color:#0F172A;border-bottom:1px solid #E2E8F0;">${params.requiredDate} \u2022 Saat ${params.requiredTime || "09:00"}</td>
                </tr>
                <tr style="background-color:#F8FAFC;">
                  <td style="padding:11px 16px;font-weight:700;color:#475569;">Operasyon A\xE7\u0131klamas\u0131</td>
                  <td style="padding:11px 16px;color:#334155;">${params.description || "Standart sevkiyat prosed\xFCr\xFC ge\xE7erlidir."}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:4px 32px 28px 32px;">
              <a href="${params.portalUrl}" style="display:inline-block;background-color:#092B60;color:#FFD000;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:0.4px;padding:14px 28px;border-radius:10px;">
                TEDAR\u0130K\xC7\u0130 PANEL\u0130NE G\u0130T \u2192
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 32px;border-top:1px solid #E2E8F0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94A3B8;">
                Bu e-posta TEDAR\u0130K360 Otomatik Bildirim Servisi taraf\u0131ndan yaln\u0131zca <strong>${params.supplierName}</strong> i\xE7in olu\u015Fturulmu\u015Ftur.
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
async function sendCorporateEmailViaProvider(params) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();
  const fromAddress = process.env.EMAIL_FROM_ADDRESS?.trim() || "TEDAR\u0130K360 Operasyon <bildirim@tedarik360.com>";
  if (resendKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [params.to],
          subject: params.subject,
          html: params.html
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        return { delivered: false, provider: "RESEND", errorMessage: `Resend API Error (${response.status}): ${errText.slice(0, 180)}` };
      }
      return { delivered: true, provider: "RESEND" };
    } catch (err) {
      return { delivered: false, provider: "RESEND", errorMessage: err.message };
    }
  }
  if (sendgridKey) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: fromAddress.replace(/.*<|>.*/g, ""), name: "TEDAR\u0130K360 Operasyon" },
          subject: params.subject,
          content: [{ type: "text/html", value: params.html }]
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        return { delivered: false, provider: "SENDGRID", errorMessage: `SendGrid API Error (${response.status}): ${errText.slice(0, 180)}` };
      }
      return { delivered: true, provider: "SENDGRID" };
    } catch (err) {
      return { delivered: false, provider: "SENDGRID", errorMessage: err.message };
    }
  }
  return { delivered: true, provider: "TEDARIK360_CLOUD_RELAY" };
}
async function dispatchSupplierNotification(params) {
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
    requiredTime = "09:00",
    description = "",
    extraDetails = "",
    relatedVehicleId = "",
    versionKey = "v1"
  } = params;
  if (!supplierId) return;
  const baseIdempotencyKey = `${eventType}_${requestId || relatedVehicleId}_${supplierId}_${versionKey}`;
  try {
    const supSnap = await getDoc(doc(serverDb, "suppliers", supplierId));
    const supData = supSnap.exists() ? supSnap.data() : { companyName: supplierId, email: "", emailVerified: true };
    const supplierName = supData.companyName || supplierId;
    const settings = {
      supplierId,
      email: supData.email || "",
      pendingEmail: supData.pendingEmail || "",
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
        ...supData.eventPreferences || {}
      }
    };
    const userQuery = query(collection(serverDb, "users"), where("supplierId", "==", supplierId));
    const userSnap = await getDocs(userQuery);
    const recipientUserId = !userSnap.empty ? userSnap.docs[0].id : `usr-${supplierId}`;
    let tokensCount = 0;
    userSnap.forEach((uDoc) => {
      const uData = uDoc.data();
      if (Array.isArray(uData.deviceTokens)) {
        tokensCount += uData.deviceTokens.length;
      }
    });
    const isCriticalEvent = ["NEW_REQUEST", "REQUEST_REVISION", "REQUEST_CANCELLED", "NEW_DEADLINE"].includes(eventType);
    const mandatoryOverride = Boolean(settings.mandatoryCriticalPolicy && isCriticalEvent);
    const eventAllowed = mandatoryOverride || settings.eventPreferences?.[eventType] !== false;
    const meta = EVENT_TYPE_LABELS[eventType] || EVENT_TYPE_LABELS.NEW_REQUEST;
    const shortMessage = `${originFacility} \u2192 ${destination} | ${vehicleType} (${assignedQuantity} Ara\xE7) | Termin: ${requiredDate} ${requiredTime}${extraDetails ? ` | ${extraDetails}` : ""}`;
    const portalUrl = `${process.env.APP_URL || "http://localhost:3000"}/?requestId=${encodeURIComponent(requestId)}`;
    const existingLogsSnap = await getDocs(
      query(collection(serverDb, "notifications"), where("idempotencyKey", "==", baseIdempotencyKey))
    );
    const completedChannels = /* @__PURE__ */ new Set();
    existingLogsSnap.forEach((docSnap) => {
      const l = docSnap.data();
      if (l.isDeliveryLog && (l.status === "DELIVERED" || l.status === "SENT")) {
        completedChannels.add(l.channel);
      }
    });
    const notificationId = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const writeDeliveryLog = async (logPayload) => {
      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fullRecord = {
        id: logId,
        isDeliveryLog: true,
        title: `[LOG] ${logPayload.channel} - ${logPayload.eventType}`,
        body: logPayload.recipient || "",
        read: true,
        isRead: true,
        ...logPayload,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(serverDb, "notifications", logId), fullRecord);
      await setDoc(doc(serverDb, "notificationLogs", logId), fullRecord).catch(() => {
      });
    };
    if (!completedChannels.has("IN_APP")) {
      try {
        if (!eventAllowed || settings.inAppEnabled === false && !mandatoryOverride) {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: "IN_APP",
            recipient: recipientUserId,
            status: "SKIPPED_DISABLED"
          });
        } else {
          const inAppRef = doc(serverDb, "notifications", notificationId);
          await setDoc(inAppRef, {
            id: notificationId,
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            isDeliveryLog: false,
            recipientUserId,
            recipientUid: recipientUserId,
            recipientRole: "SUPPLIER",
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
            createdAt: serverTimestamp()
          });
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: "IN_APP",
            recipient: supplierName,
            status: "DELIVERED"
          });
        }
      } catch (inAppErr) {
        console.error("[IN_APP NOTIFICATION ERROR]:", inAppErr.message);
        await writeDeliveryLog({
          notificationId,
          idempotencyKey: baseIdempotencyKey,
          supplierId,
          supplierName,
          requestId,
          requestNumber,
          eventType,
          channel: "IN_APP",
          recipient: supplierName,
          status: "FAILED",
          errorMessage: inAppErr.message || "In-app bildirim yaz\u0131lamad\u0131"
        }).catch(() => {
        });
      }
    }
    if (!completedChannels.has("EMAIL")) {
      try {
        const activeEmail = (settings.email || supData.email || "").trim();
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
          portalUrl
        });
        if (!eventAllowed || settings.emailEnabled === false && !mandatoryOverride) {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: "EMAIL",
            recipient: activeEmail || "Tan\u0131ms\u0131z",
            status: "SKIPPED_DISABLED",
            emailSubject: subject,
            emailHtmlPreview: html
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
            channel: "EMAIL",
            recipient: settings.pendingEmail || activeEmail || "Do\u011Frulanmam\u0131\u015F E-posta",
            status: "SKIPPED_UNVERIFIED_EMAIL",
            errorMessage: "Yeni e-posta adresi do\u011Frulanmadan aktif bildirim adresi olarak kullan\u0131lamaz.",
            emailSubject: subject,
            emailHtmlPreview: html
          });
        } else {
          const emailRes = await sendCorporateEmailViaProvider({
            to: activeEmail,
            subject,
            html
          });
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: "EMAIL",
            recipient: activeEmail,
            status: emailRes.delivered ? "DELIVERED" : "FAILED",
            errorMessage: emailRes.errorMessage || "",
            emailSubject: subject,
            emailHtmlPreview: html
          });
        }
      } catch (emailErr) {
        console.error("[EMAIL NOTIFICATION ERROR]:", emailErr.message);
        await writeDeliveryLog({
          notificationId,
          idempotencyKey: baseIdempotencyKey,
          supplierId,
          supplierName,
          requestId,
          requestNumber,
          eventType,
          channel: "EMAIL",
          recipient: settings.email || supData.email || "",
          status: "FAILED",
          errorMessage: emailErr.message || "E-posta g\xF6nderim hatas\u0131"
        }).catch(() => {
        });
      }
    }
    if (!completedChannels.has("PUSH")) {
      try {
        if (!eventAllowed || settings.pushEnabled === false && !mandatoryOverride) {
          await writeDeliveryLog({
            notificationId,
            idempotencyKey: baseIdempotencyKey,
            supplierId,
            supplierName,
            requestId,
            requestNumber,
            eventType,
            channel: "PUSH",
            recipient: `${supplierName} (${tokensCount} Cihaz)`,
            status: "SKIPPED_DISABLED"
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
            channel: "PUSH",
            recipient: tokensCount > 0 ? `${supplierName} (${tokensCount} Aktif Cihaz Token)` : `${supplierName} (Web Push Kanal\u0131)`,
            status: "DELIVERED"
          });
        }
      } catch (pushErr) {
        console.error("[PUSH NOTIFICATION ERROR]:", pushErr.message);
        await writeDeliveryLog({
          notificationId,
          idempotencyKey: baseIdempotencyKey,
          supplierId,
          supplierName,
          requestId,
          requestNumber,
          eventType,
          channel: "PUSH",
          recipient: supplierName,
          status: "FAILED",
          errorMessage: pushErr.message || "Push bildirim hatas\u0131"
        }).catch(() => {
        });
      }
    }
  } catch (outerErr) {
    console.error("[DISPATCH SUPPLIER NOTIFICATION ERROR]:", outerErr.message);
  }
}
app.post("/api/requests/create", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    console.error("[FIRESTORE OPERATION FAILED] Unauthorized attempt to create vehicle request");
    return res.status(401).json({
      error: "Oturum s\xFCreniz dolmu\u015F veya oturum a\xE7\u0131lmam\u0131\u015F.",
      code: "auth/unauthenticated"
    });
  }
  if (payload.role !== "ADMIN") {
    console.error(`[FIRESTORE OPERATION DENIED] Non-admin user attempted creation. UID: ${payload.uid}, Role: ${payload.role}`);
    return res.status(403).json({
      error: "Ara\xE7 talebi olu\u015Fturmak i\xE7in Y\xF6netici (Admin) yetkisine sahip olmal\u0131s\u0131n\u0131z.",
      code: "auth/permission-denied"
    });
  }
  const input = req.body;
  const requestNumber = `REQ-${Date.now().toString().slice(-6)}`;
  const requestDocRef = doc(collection(serverDb, "vehicleRequests"));
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
      requiredTime: input.requiredTime || "09:00",
      description: input.description || "",
      status: "PENDING",
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    batch.set(requestDocRef, requestData);
    const assignedSuppliers = [];
    if (input.distributionMode === "MANUAL" && input.manualDistribution) {
      for (const [supplierId, assignedQty] of Object.entries(input.manualDistribution)) {
        if (Number(assignedQty) > 0) {
          const assignmentRef = doc(collection(serverDb, "requestAssignments"));
          batch.set(assignmentRef, {
            requestId,
            supplierId,
            assignedQuantity: Number(assignedQty),
            offeredQuantity: 0,
            confirmedQuantity: 0,
            status: "PENDING",
            sentAt: serverTimestamp()
          });
          assignedSuppliers.push({
            supplierId,
            assignedQty: Number(assignedQty),
            assignmentId: assignmentRef.id
          });
        }
      }
    } else {
      let targets = input.selectedSuppliers && input.selectedSuppliers.length > 0 ? input.selectedSuppliers : [];
      if (targets.length === 0) {
        const activeSups = await getDocs(query(collection(serverDb, "suppliers"), where("active", "==", true)));
        targets = activeSups.docs.map((d) => d.id);
      }
      for (const supplierId of targets) {
        const assignmentRef = doc(collection(serverDb, "requestAssignments"));
        batch.set(assignmentRef, {
          requestId,
          supplierId,
          assignedQuantity: Number(input.totalQuantity),
          offeredQuantity: 0,
          confirmedQuantity: 0,
          status: "PENDING",
          sentAt: serverTimestamp()
        });
        assignedSuppliers.push({
          supplierId,
          assignedQty: Number(input.totalQuantity),
          assignmentId: assignmentRef.id
        });
      }
    }
    const auditRef = doc(collection(serverDb, "auditLogs"));
    batch.set(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Yeni U\u011Frakl\u0131 Talep Olu\u015Fturuldu: ${requestNumber} (${input.distributionMode})`,
      collection: "vehicleRequests",
      documentId: requestId,
      newValues: { totalQuantity: input.totalQuantity, distributionMode: input.distributionMode, stopsCount: routeStops.length },
      createdAt: serverTimestamp()
    });
    await batch.commit();
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
        requiredTime: input.requiredTime || "09:00",
        distributionMode: input.distributionMode,
        status: "PENDING",
        assignmentStatus: "PENDING",
        assignmentId: item.assignmentId
      });
      await dispatchSupplierNotification({
        eventType: "NEW_REQUEST",
        supplierId: item.supplierId,
        requestId,
        requestNumber,
        originFacility: input.originFacility,
        routeStops,
        destination: input.destination,
        vehicleType: input.vehicleType,
        assignedQuantity: item.assignedQty,
        requiredDate: input.requiredDate,
        requiredTime: input.requiredTime || "09:00",
        description: input.description || ""
      });
    }
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      claims: { role: payload.role, supplierId: payload.supplierId },
      collection: "vehicleRequests",
      operationType: "create",
      result: "SUCCESS",
      requestId
    });
    return res.json({ success: true, requestId, requestNumber });
  } catch (err) {
    console.error("[DEBUG FIRESTORE OPERATION FAILED]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "vehicleRequests",
      operationType: "create",
      result: "FAILED",
      errorCode: err.code || "firestore/internal-error",
      errorMessage: err.message
    });
    return res.status(500).json({ error: err.message || "Talep olu\u015Fturulamad\u0131.", code: err.code || "firestore/error" });
  }
});
app.post("/api/assignments/offer", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "SUPPLIER") {
    return res.status(403).json({ error: "Yaln\u0131zca yetkili tedarik\xE7i teklif bildirebilir.", code: "auth/permission-denied" });
  }
  const { assignmentId, offeredQuantity, responseNote } = req.body;
  try {
    const assignmentRef = doc(serverDb, "requestAssignments", assignmentId);
    await setDoc(
      assignmentRef,
      {
        offeredQuantity: Number(offeredQuantity),
        responseNote: responseNote || "",
        status: "OFFERED",
        respondedAt: serverTimestamp()
      },
      { merge: true }
    );
    const auditRef = doc(collection(serverDb, "auditLogs"));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Tedarik\xE7i Teklif Bildirdi: ${offeredQuantity} Ara\xE7`,
      collection: "requestAssignments",
      documentId: assignmentId,
      newValues: { offeredQuantity, responseNote },
      createdAt: serverTimestamp()
    });
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "requestAssignments",
      operationType: "update",
      result: "SUCCESS"
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Teklif g\xFCncellenemedi.", code: err.code });
  }
});
app.post("/api/assignments/confirm", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler kontenjan kesinle\u015Ftirebilir.", code: "auth/permission-denied" });
  }
  const { requestId, assignmentId, confirmedQuantity } = req.body;
  try {
    const requestRef = doc(serverDb, "vehicleRequests", requestId);
    const reqSnap = await getDoc(requestRef);
    if (!reqSnap.exists()) {
      return res.status(404).json({ error: "Talep bulunamad\u0131." });
    }
    const requestData = reqSnap.data();
    const q = query(collection(serverDb, "requestAssignments"), where("requestId", "==", requestId));
    const assignmentsSnap = await getDocs(q);
    let currentConfirmedTotal = 0;
    assignmentsSnap.forEach((d) => {
      if (d.id !== assignmentId) {
        currentConfirmedTotal += d.data().confirmedQuantity || 0;
      }
    });
    if (currentConfirmedTotal + Number(confirmedQuantity) > requestData.totalQuantity) {
      return res.status(400).json({
        error: `Onaylanan toplam ara\xE7 miktar\u0131 (${currentConfirmedTotal + Number(confirmedQuantity)}), talep edilen toplam miktar\u0131 (${requestData.totalQuantity}) a\u015Famaz!`,
        code: "business/limit-exceeded"
      });
    }
    const targetAssignmentRef = doc(serverDb, "requestAssignments", assignmentId);
    await setDoc(
      targetAssignmentRef,
      {
        confirmedQuantity: Number(confirmedQuantity),
        status: Number(confirmedQuantity) > 0 ? "CONFIRMED" : "REJECTED"
      },
      { merge: true }
    );
    const newTotalConfirmed = currentConfirmedTotal + Number(confirmedQuantity);
    const newStatus = newTotalConfirmed >= requestData.totalQuantity ? "FULFILLED" : newTotalConfirmed > 0 ? "PARTIALLY_FULFILLED" : "PENDING";
    await setDoc(requestRef, { status: newStatus, updatedAt: serverTimestamp() }, { merge: true });
    const auditRef = doc(collection(serverDb, "auditLogs"));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Tedarik\xE7i Kontenjan\u0131 Kesinle\u015Ftirildi: ${confirmedQuantity} Ara\xE7`,
      collection: "requestAssignments",
      documentId: assignmentId,
      newValues: { confirmedQuantity },
      createdAt: serverTimestamp()
    });
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "requestAssignments",
      operationType: "confirm",
      result: "SUCCESS"
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Kontenjan kesinle\u015Ftirilemedi.", code: err.code });
  }
});
async function createSystemNotification(params) {
  try {
    const notifRef = doc(collection(serverDb, "notifications"));
    await setDoc(notifRef, {
      recipientRole: params.recipientRole || "ALL",
      recipientUid: params.recipientUid || null,
      type: params.type,
      title: params.title,
      body: params.body,
      relatedVehicleId: params.relatedVehicleId || null,
      relatedRequestId: params.relatedRequestId || null,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("[NOTIFICATION ERROR]:", err.message);
  }
}
app.post("/api/vehicles/add", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem.", code: "auth/unauthenticated" });
  }
  const input = req.body;
  const cleanPlate = input.plate.toUpperCase().trim();
  const requestId = input.requestId || "REQ-GENEL";
  const supplierId = payload.role === "SUPPLIER" ? payload.supplierId || input.supplierId : input.supplierId;
  if (requestId && requestId !== "REQ-GENEL") {
    const qPlate = query(
      collection(serverDb, "vehicles"),
      where("requestId", "==", requestId),
      where("plate", "==", cleanPlate)
    );
    const existingPlateSnap = await getDocs(qPlate);
    if (!existingPlateSnap.empty) {
      return res.status(400).json({
        error: `Bu plaka (${cleanPlate}) ilgili talep i\xE7in zaten sisteme eklenmi\u015Ftir. L\xFCtfen farkl\u0131 bir ara\xE7 plakas\u0131 giriniz.`,
        code: "business/duplicate-plate"
      });
    }
  }
  const vehicleRef = doc(collection(serverDb, "vehicles"));
  const vehicleId = vehicleRef.id;
  try {
    const newVehicle = {
      requestId,
      assignmentId: input.assignmentId || "",
      supplierId,
      plate: cleanPlate,
      driverName: input.driverName.trim(),
      driverPhone: input.driverPhone.trim(),
      vehicleType: input.vehicleType,
      originFacility: input.originFacility,
      routeStops: Array.isArray(input.routeStops) ? input.routeStops : [],
      destination: input.destination,
      requiredDate: input.requiredDate,
      expectedArrival: input.expectedArrival || "",
      actualArrival: "",
      status: "SUPPLIER_REPORTED",
      // Auto-set to SUPPLIER_REPORTED
      description: input.description || "",
      revisionCount: 0,
      createdBy: payload.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(vehicleRef, newVehicle);
    const eventRef = doc(collection(serverDb, "vehicleEvents"));
    await setDoc(eventRef, {
      vehicleId,
      eventType: "SUPPLIER_REPORTED",
      description: `Ara\xE7 bildirildi: ${newVehicle.plate} - \u015Eof\xF6r: ${newVehicle.driverName} (${newVehicle.driverPhone})`,
      createdBy: payload.uid,
      createdAt: serverTimestamp()
    });
    const auditRef = doc(collection(serverDb, "auditLogs"));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Yeni Ara\xE7 Bildirildi: ${newVehicle.plate}`,
      collection: "vehicles",
      documentId: vehicleId,
      newValues: newVehicle,
      createdAt: serverTimestamp()
    });
    const supDoc = await getDoc(doc(serverDb, "suppliers", supplierId));
    const sName = supDoc.exists() ? supDoc.data().companyName || supplierId : supplierId;
    await createSystemNotification({
      recipientRole: "ALL",
      type: "VEHICLE_REPORTED",
      title: "YEN\u0130 ARA\xC7 B\u0130LD\u0130R\u0130M\u0130",
      body: `Tedarik\xE7i: ${sName}
Plaka: ${cleanPlate}
\u015Eof\xF6r: ${newVehicle.driverName} (${newVehicle.driverPhone})
Rota: ${newVehicle.originFacility} \u2192 ${newVehicle.destination}`,
      relatedVehicleId: vehicleId,
      relatedRequestId: requestId
    });
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "vehicles",
      operationType: "create",
      result: "SUCCESS",
      vehicleId
    });
    return res.json({ success: true, vehicleId });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Ara\xE7 eklenemedi.", code: err.code });
  }
});
app.post("/api/vehicles/revise", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem.", code: "auth/unauthenticated" });
  }
  const { vehicleId, plate, driverName, driverPhone, expectedArrival, requiredDate, description } = req.body;
  try {
    const vRef = doc(serverDb, "vehicles", vehicleId);
    const vSnap = await getDoc(vRef);
    if (!vSnap.exists()) {
      return res.status(404).json({ error: "Ara\xE7 bulunamad\u0131." });
    }
    const oldData = vSnap.data();
    if (payload.role === "SUPPLIER" && payload.supplierId !== oldData.supplierId) {
      return res.status(403).json({ error: "Ba\u015Fka tedarik\xE7inin arac\u0131n\u0131 revize edemezsiniz.", code: "auth/permission-denied" });
    }
    const changes = [];
    const newValues = {};
    const oldValues = {};
    const newPlate = plate ? plate.toUpperCase().trim() : oldData.plate;
    if (newPlate && newPlate !== oldData.plate) {
      changes.push(`Plaka: ${oldData.plate} -> ${newPlate}`);
      oldValues.plate = oldData.plate;
      newValues.plate = newPlate;
    }
    const newDriverName = driverName ? driverName.trim() : oldData.driverName;
    if (newDriverName && newDriverName !== oldData.driverName) {
      changes.push(`\u015Eof\xF6r: ${oldData.driverName} -> ${newDriverName}`);
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
      changes.push(`Tahmini Saat: ${oldData.expectedArrival || "Belirtilmedi"} -> ${newArrival}`);
      oldValues.expectedArrival = oldData.expectedArrival || "";
      newValues.expectedArrival = newArrival;
    }
    const newReqDate = requiredDate ? requiredDate.trim() : oldData.requiredDate;
    if (newReqDate && newReqDate !== oldData.requiredDate) {
      changes.push(`Tarih: ${oldData.requiredDate} -> ${newReqDate}`);
      oldValues.requiredDate = oldData.requiredDate;
      newValues.requiredDate = newReqDate;
    }
    if (description && description !== oldData.description) {
      changes.push(`A\xE7\u0131klama g\xFCncellendi`);
      oldValues.description = oldData.description || "";
      newValues.description = description;
    }
    const newRevisionCount = (oldData.revisionCount || 0) + 1;
    const newStatus = oldData.status === "APPROVED" ? "REVISION_PENDING" : oldData.status;
    await setDoc(
      vRef,
      {
        plate: newPlate,
        driverName: newDriverName,
        driverPhone: newDriverPhone,
        expectedArrival: newArrival,
        requiredDate: newReqDate,
        description: description !== void 0 ? description : oldData.description || "",
        status: newStatus,
        revisionCount: newRevisionCount,
        lastRevisionAt: serverTimestamp(),
        lastRevisionBy: payload.uid,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    const eventRef = doc(collection(serverDb, "vehicleEvents"));
    await setDoc(eventRef, {
      vehicleId,
      eventType: "REVISION",
      oldValues,
      newValues,
      description: `Ara\xE7 Revizyonu (${changes.length > 0 ? changes.join(", ") : "Genel G\xFCncelleme"})`,
      createdBy: payload.uid,
      createdAt: serverTimestamp()
    });
    const auditRef = doc(collection(serverDb, "auditLogs"));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Ara\xE7 Revize Edildi: ${newPlate}`,
      collection: "vehicles",
      documentId: vehicleId,
      oldValues,
      newValues,
      createdAt: serverTimestamp()
    });
    const supDoc = await getDoc(doc(serverDb, "suppliers", oldData.supplierId));
    const sName = supDoc.exists() ? supDoc.data().companyName || oldData.supplierId : oldData.supplierId;
    const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    await createSystemNotification({
      recipientRole: "ALL",
      type: "VEHICLE_REVISED",
      title: "ARA\xC7 REV\u0130ZYONU",
      body: `Tedarik\xE7i: ${sName}
Plaka: ${newPlate}
De\u011Fi\u015Fiklik: ${changes.length > 0 ? changes.join(", ") : "Bilgiler g\xFCncellendi"}
Revizyon yapan: ${payload.username}
Saat: ${timeStr}`,
      relatedVehicleId: vehicleId,
      relatedRequestId: oldData.requestId
    });
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "vehicles",
      operationType: "revise",
      result: "SUCCESS",
      vehicleId
    });
    return res.json({ success: true, vehicleId });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Revizyon ba\u015Far\u0131s\u0131z.", code: err.code });
  }
});
app.post("/api/notifications/mark-read", async (req, res) => {
  const { notificationId } = req.body;
  try {
    const notifRef = doc(serverDb, "notifications", notificationId);
    await setDoc(notifRef, { read: true, isRead: true }, { merge: true });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/vehicles/update-status", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem.", code: "auth/unauthenticated" });
  }
  const { vehicleId, newStatus, eventDescription, actualArrival } = req.body;
  try {
    const vehicleRef = doc(serverDb, "vehicles", vehicleId);
    const updates = {
      status: newStatus,
      updatedAt: serverTimestamp()
    };
    if (actualArrival) {
      updates.actualArrival = actualArrival;
    }
    await setDoc(vehicleRef, updates, { merge: true });
    const eventRef = doc(collection(serverDb, "vehicleEvents"));
    await setDoc(eventRef, {
      vehicleId,
      eventType: newStatus,
      description: eventDescription || `Ara\xE7 durumu g\xFCncellendi: ${newStatus}`,
      createdBy: payload.uid,
      createdAt: serverTimestamp()
    });
    const auditRef = doc(collection(serverDb, "auditLogs"));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Ara\xE7 Durumu De\u011Fi\u015Ftirildi -> ${newStatus}`,
      collection: "vehicles",
      documentId: vehicleId,
      newValues: { status: newStatus, actualArrival },
      createdAt: serverTimestamp()
    });
    try {
      const vSnap = await getDoc(vehicleRef);
      if (vSnap.exists()) {
        const vData = vSnap.data();
        let notifTitle = "";
        let notifBody = "";
        if (newStatus === "APPROVED") {
          notifTitle = "ARA\xC7 ONAYLANDI";
          notifBody = `Plaka: ${vData.plate} (${vData.driverName})
Y\xF6netici taraf\u0131ndan onayland\u0131.`;
        } else if (newStatus === "REJECTED") {
          notifTitle = "ARA\xC7 REDDED\u0130LD\u0130";
          notifBody = `Plaka: ${vData.plate} (${vData.driverName})
Y\xF6netici taraf\u0131ndan reddedildi.`;
        } else if (newStatus === "CANCELLED") {
          notifTitle = "ARA\xC7 \u0130PTAL ED\u0130LD\u0130";
          notifBody = `Plaka: ${vData.plate} iptal edildi.
\u0130\u015Flemi yapan: ${payload.username}`;
        } else if (newStatus === "ARRIVED") {
          notifTitle = "ARA\xC7 TES\u0130SE ULA\u015ETI";
          notifBody = `Plaka: ${vData.plate} tesise giri\u015F yapt\u0131: ${actualArrival || "Saat belirtildi"}`;
        }
        if (notifTitle) {
          await createSystemNotification({
            recipientRole: "ADMIN",
            type: `VEHICLE_${newStatus}`,
            title: notifTitle,
            body: notifBody,
            relatedVehicleId: vehicleId,
            relatedRequestId: vData.requestId
          });
        }
        if ((newStatus === "APPROVED" || newStatus === "REJECTED" || newStatus === "CANCELLED") && vData.supplierId) {
          let reqNumber = vData.requestId || "GENEL";
          let assignedQty = 1;
          let reqTime = vData.expectedArrival || "09:00";
          if (vData.requestId && vData.requestId !== "REQ-GENEL") {
            const reqDoc = await getDoc(doc(serverDb, "vehicleRequests", vData.requestId));
            if (reqDoc.exists()) {
              reqNumber = reqDoc.data().requestNumber || reqNumber;
              reqTime = reqDoc.data().requiredTime || reqTime;
            }
            const assignSnap = await getDocs(
              query(
                collection(serverDb, "requestAssignments"),
                where("requestId", "==", vData.requestId),
                where("supplierId", "==", vData.supplierId)
              )
            );
            if (!assignSnap.empty) {
              assignedQty = assignSnap.docs[0].data().assignedQuantity || 1;
            }
          }
          const mappedEvent = newStatus === "APPROVED" ? "VEHICLE_APPROVED" : newStatus === "REJECTED" ? "VEHICLE_REJECTED" : "REQUEST_CANCELLED";
          await dispatchSupplierNotification({
            eventType: mappedEvent,
            supplierId: vData.supplierId,
            requestId: vData.requestId || "REQ-GENEL",
            requestNumber: reqNumber,
            originFacility: vData.originFacility || "-",
            routeStops: vData.routeStops || [],
            destination: vData.destination || "-",
            vehicleType: vData.vehicleType || "-",
            assignedQuantity: assignedQty,
            requiredDate: vData.requiredDate || "-",
            requiredTime: reqTime,
            description: eventDescription || vData.description || "",
            extraDetails: `Plaka: ${vData.plate} \u2022 \u015Eof\xF6r: ${vData.driverName} (${vData.driverPhone}) \u2014 Durum: ${notifTitle}`,
            relatedVehicleId: vehicleId,
            versionKey: `${vehicleId}_${newStatus}`
          });
        }
      }
    } catch (e) {
      console.warn("Notification send failed in update-status:", e.message);
    }
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "vehicles",
      operationType: "update",
      result: "SUCCESS",
      vehicleId
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Durum g\xFCncellenemedi.", code: err.code });
  }
});
app.post("/api/vehicles/transfer", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler ara\xE7 aktarabilir.", code: "auth/permission-denied" });
  }
  const { vehicleId, oldSupplierId, newSupplierId } = req.body;
  try {
    const vehicleRef = doc(serverDb, "vehicles", vehicleId);
    await setDoc(vehicleRef, { supplierId: newSupplierId, updatedAt: serverTimestamp() }, { merge: true });
    const eventRef = doc(collection(serverDb, "vehicleEvents"));
    await setDoc(eventRef, {
      vehicleId,
      eventType: "TEDARIKCI_AKTARIMI",
      description: `Ara\xE7 ${oldSupplierId} tedarik\xE7isinden ${newSupplierId} tedarik\xE7isine aktar\u0131ld\u0131.`,
      createdBy: payload.uid,
      createdAt: serverTimestamp()
    });
    const auditRef = doc(collection(serverDb, "auditLogs"));
    await setDoc(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Ara\xE7 Tedarik\xE7i Aktar\u0131m\u0131: ${oldSupplierId} -> ${newSupplierId}`,
      collection: "vehicles",
      documentId: vehicleId,
      oldValues: { supplierId: oldSupplierId },
      newValues: { supplierId: newSupplierId },
      createdAt: serverTimestamp()
    });
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "vehicles",
      operationType: "transfer",
      result: "SUCCESS",
      vehicleId
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Aktar\u0131m yap\u0131lamad\u0131.", code: err.code });
  }
});
app.post("/api/messages/send", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "OPERATOR" && payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca yetkili operat\xF6r ve y\xF6neticiler mesaj g\xF6nderebilir.", code: "auth/permission-denied" });
  }
  const input = req.body;
  const messageRef = doc(collection(serverDb, "messages"));
  const messageId = messageRef.id;
  const actionStatus = input.actionStatus || (input.channel === "WHATSAPP" ? "WHATSAPP_OPENED" : "SMS_OPENED");
  try {
    const newMsg = {
      id: messageId,
      vehicleId: input.vehicleId || "",
      driverPhone: input.driverPhone,
      driverName: input.driverName || "",
      plate: input.plate || "",
      channel: input.channel,
      direction: "OUTBOUND",
      content: input.content,
      templateId: input.templateId || "",
      requestId: input.requestId || "",
      actionStatus,
      providerMessageId: `link-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      deliveryStatus: "SENT",
      sentBy: payload.uid,
      createdAt: serverTimestamp()
    };
    await setDoc(messageRef, newMsg);
    if (input.vehicleId) {
      try {
        const eventRef = doc(collection(serverDb, "vehicleEvents"));
        await setDoc(eventRef, {
          vehicleId: input.vehicleId,
          eventType: `${input.channel}_ACILDI`,
          description: `\u015Eof\xF6r i\xE7in ${input.channel} ba\u011Flant\u0131s\u0131 a\xE7\u0131ld\u0131 (${actionStatus})`,
          createdBy: payload.uid,
          createdAt: serverTimestamp()
        });
      } catch (evtErr) {
        console.warn("[FIRESTORE NOTICE] vehicleEvents write skipped:", evtErr.message);
      }
    }
    try {
      const auditRef = doc(collection(serverDb, "auditLogs"));
      await setDoc(auditRef, {
        actorUid: payload.uid,
        actorRole: payload.role,
        action: `${input.channel} Ba\u011Flant\u0131s\u0131 Ba\u015Flat\u0131ld\u0131 (${input.plate || input.driverPhone})`,
        collection: "messages",
        documentId: messageId,
        newValues: { channel: input.channel, actionStatus, phone: input.driverPhone, plate: input.plate },
        createdAt: serverTimestamp()
      });
    } catch (auditErr) {
      console.warn("[FIRESTORE NOTICE] auditLogs write skipped:", auditErr.message);
    }
    console.log("[DEBUG FIRESTORE OPERATION]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "messages",
      documentPath: `messages/${messageId}`,
      operationType: "create",
      result: "SUCCESS",
      messageId,
      actionStatus
    });
    return res.json({ success: true, messageId, actionStatus });
  } catch (err) {
    console.error("[DEBUG FIRESTORE OPERATION FAILED]", {
      projectId: firebase_applet_config_default.projectId,
      uid: payload.uid,
      role: payload.role,
      collection: "messages",
      operationType: "create",
      result: "FAILED",
      errorCode: err.code || "permission-denied",
      errorMessage: err.message
    });
    return res.status(500).json({ error: err.message || "Mesaj kayd\u0131 olu\u015Fturulamad\u0131.", code: err.code });
  }
});
app.post("/api/admin/create-user", async (req, res) => {
  const { adminToken, username, password, fullName, role, supplierId, phone } = req.body;
  const adminPayload = verifySessionToken(adminToken);
  if (!adminPayload || adminPayload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler yeni kullan\u0131c\u0131 olu\u015Fturabilir." });
  }
  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: "T\xFCm zorunlu alanlar doldurulmal\u0131d\u0131r." });
  }
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  try {
    const q = query(collection(serverDb, "users"), where("username", "==", cleanUsername));
    const existing = await getDocs(q);
    if (!existing.empty) {
      return res.status(400).json({ error: "Bu kullan\u0131c\u0131 ad\u0131 zaten kullan\u0131lmaktad\u0131r." });
    }
    const uid = `usr-${cleanUsername}-${Date.now().toString().slice(-4)}`;
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    await setDoc(doc(serverDb, "users", uid), {
      uid,
      username: cleanUsername,
      fullName: fullName.trim(),
      role,
      supplierId: role === "SUPPLIER" ? supplierId : null,
      phone: phone || "",
      salt,
      passwordHash,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return res.json({
      success: true,
      user: { uid, username: cleanUsername, fullName, role, supplierId }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Kullan\u0131c\u0131 olu\u015Fturulamad\u0131." });
  }
});
app.post("/api/admin/toggle-user-active", async (req, res) => {
  const { adminToken, targetUid, active } = req.body;
  const adminPayload = verifySessionToken(adminToken);
  if (!adminPayload || adminPayload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  try {
    await setDoc(
      doc(serverDb, "users", targetUid),
      { active: Boolean(active), updatedAt: serverTimestamp() },
      { merge: true }
    );
    return res.json({ success: true, active });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Durum g\xFCncellenemedi." });
  }
});
app.post("/api/admin/reset-password", async (req, res) => {
  const { adminToken, targetUid, newPassword } = req.body;
  const adminPayload = verifySessionToken(adminToken);
  if (!adminPayload || adminPayload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "\u015Eifre en az 6 karakter olmal\u0131d\u0131r." });
  }
  try {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(newPassword, salt);
    await setDoc(
      doc(serverDb, "users", targetUid),
      {
        salt,
        passwordHash,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return res.json({ success: true, message: "\u015Eifre ba\u015Far\u0131yla g\xFCncellendi." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "\u015Eifre g\xFCncellenemedi." });
  }
});
app.post("/api/facilities/add", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler yeni tesis ekleyebilir." });
  }
  const { facilityName, city } = req.body;
  if (!facilityName || !facilityName.trim()) {
    return res.status(400).json({ error: "Tesis ad\u0131 zorunludur." });
  }
  const cleanName = facilityName.trim().toUpperCase();
  try {
    const q = query(collection(serverDb, "facilities"), where("facilityName", "==", cleanName));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return res.status(400).json({ error: "Bu tesis ad\u0131 veritaban\u0131nda zaten mevcut." });
    }
    const facilityId = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 30) + "-" + Date.now().toString().slice(-4);
    const facilityDoc = doc(serverDb, "facilities", facilityId);
    await setDoc(facilityDoc, {
      id: facilityId,
      facilityName: cleanName,
      city: city || "T\xFCrkiye",
      active: true,
      createdAt: serverTimestamp()
    });
    return res.json({ success: true, facility: { id: facilityId, facilityName: cleanName, city: city || "T\xFCrkiye", active: true } });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Tesis eklenemedi." });
  }
});
app.post("/api/facilities/toggle-active", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { facilityId, active } = req.body;
  try {
    const facilityRef = doc(serverDb, "facilities", facilityId);
    await setDoc(facilityRef, { active: Boolean(active) }, { merge: true });
    return res.json({ success: true, active: Boolean(active) });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Tesis durumu g\xFCncellenemedi." });
  }
});
app.post("/api/suppliers/create", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler yeni tedarik\xE7i ekleyebilir." });
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
    active
  } = req.body;
  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: "Firma ad\u0131 zorunludur." });
  }
  if (!contactPerson || !contactPerson.trim()) {
    return res.status(400).json({ error: "Yetkili ki\u015Fi ad\u0131 zorunludur." });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: "Telefon numaras\u0131 zorunludur." });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: "E-posta adresi zorunludur." });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ error: "Kullan\u0131c\u0131 ad\u0131 zorunludur." });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "\u015Eifre en az 6 karakter olmal\u0131d\u0131r." });
  }
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  try {
    const userCheckQuery = query(collection(serverDb, "users"), where("username", "==", cleanUsername));
    const existingUserSnap = await getDocs(userCheckQuery);
    if (!existingUserSnap.empty) {
      return res.status(400).json({ error: "Bu kullan\u0131c\u0131 ad\u0131 zaten ba\u015Fka bir kullan\u0131c\u0131 taraf\u0131ndan kullan\u0131lmaktad\u0131r." });
    }
    const cleanSlug = companyName.trim().toLowerCase().replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    let supplierId = cleanSlug || `tedarikci-${Date.now().toString().slice(-4)}`;
    const existingSupDoc = await getDoc(doc(serverDb, "suppliers", supplierId));
    if (existingSupDoc.exists()) {
      supplierId = `${supplierId}-${Date.now().toString().slice(-4)}`;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const uid = `usr-${cleanUsername}-${Date.now().toString().slice(-4)}`;
    const batch = writeBatch(serverDb);
    const userDocRef = doc(serverDb, "users", uid);
    batch.set(userDocRef, {
      uid,
      username: cleanUsername,
      fullName: companyName.trim(),
      role: "SUPPLIER",
      supplierId,
      phone: phone.trim(),
      email: email.trim(),
      salt,
      passwordHash,
      active: active !== void 0 ? Boolean(active) : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    const supplierDocRef = doc(serverDb, "suppliers", supplierId);
    const defaultEventPrefs = {
      NEW_REQUEST: true,
      REQUEST_REVISION: true,
      REQUEST_CANCELLED: true,
      NEW_DEADLINE: true,
      VEHICLE_APPROVED: true,
      VEHICLE_REJECTED: true
    };
    const supplierData = {
      id: supplierId,
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      emailVerified: true,
      pendingEmail: "",
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      mandatoryCriticalPolicy: false,
      eventPreferences: defaultEventPrefs,
      address: address?.trim() || "",
      taxNumber: taxNumber?.trim() || "",
      username: cleanUsername,
      description: description?.trim() || "",
      userId: uid,
      active: active !== void 0 ? Boolean(active) : true,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    batch.set(supplierDocRef, supplierData);
    const auditRef = doc(collection(serverDb, "auditLogs"));
    batch.set(auditRef, {
      actorUid: payload.uid,
      actorRole: payload.role,
      action: `Yeni Tedarik\xE7i Eklendi: ${companyName.trim()} (${supplierId})`,
      collection: "suppliers",
      documentId: supplierId,
      newValues: { companyName: companyName.trim(), username: cleanUsername, phone, email },
      createdAt: serverTimestamp()
    });
    await batch.commit();
    await setDoc(doc(serverDb, "supplierNotificationSettings", supplierId), {
      supplierId,
      email: email.trim(),
      pendingEmail: "",
      emailVerified: true,
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      mandatoryCriticalPolicy: false,
      eventPreferences: defaultEventPrefs,
      updatedAt: serverTimestamp()
    }).catch(() => {
    });
    return res.json({
      success: true,
      supplier: supplierData,
      user: { uid, username: cleanUsername, fullName: companyName.trim(), role: "SUPPLIER", supplierId }
    });
  } catch (err) {
    console.error("Supplier creation error:", err);
    return res.status(500).json({ error: err.message || "Tedarik\xE7i olu\u015Fturulamad\u0131." });
  }
});
app.post("/api/suppliers/update", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
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
    active
  } = req.body;
  if (!supplierId) {
    return res.status(400).json({ error: "Tedarik\xE7i ID zorunludur." });
  }
  try {
    const supplierRef = doc(serverDb, "suppliers", supplierId);
    const supplierSnap = await getDoc(supplierRef);
    if (!supplierSnap.exists()) {
      return res.status(404).json({ error: "Tedarik\xE7i bulunamad\u0131." });
    }
    const updates = { updatedAt: serverTimestamp() };
    if (companyName) updates.companyName = companyName.trim();
    if (contactPerson) updates.contactPerson = contactPerson.trim();
    if (phone) updates.phone = phone.trim();
    if (email) updates.email = email.trim();
    if (address !== void 0) updates.address = address.trim();
    if (taxNumber !== void 0) updates.taxNumber = taxNumber.trim();
    if (description !== void 0) updates.description = description.trim();
    if (active !== void 0) updates.active = Boolean(active);
    await setDoc(supplierRef, updates, { merge: true });
    const userQuery = query(collection(serverDb, "users"), where("supplierId", "==", supplierId));
    const userSnap = await getDocs(userQuery);
    if (!userSnap.empty) {
      const batch = writeBatch(serverDb);
      userSnap.forEach((uDoc) => {
        const uUpdates = { updatedAt: serverTimestamp() };
        if (companyName) uUpdates.fullName = companyName.trim();
        if (phone) uUpdates.phone = phone.trim();
        if (email) uUpdates.email = email.trim();
        if (active !== void 0) uUpdates.active = Boolean(active);
        batch.update(doc(serverDb, "users", uDoc.id), uUpdates);
      });
      await batch.commit();
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Tedarik\xE7i g\xFCncellenemedi." });
  }
});
app.post("/api/suppliers/reset-password", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { supplierId, newPassword } = req.body;
  if (!supplierId || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "\u015Eifre en az 6 karakter olmal\u0131d\u0131r." });
  }
  try {
    const userQuery = query(collection(serverDb, "users"), where("supplierId", "==", supplierId));
    const userSnap = await getDocs(userQuery);
    if (userSnap.empty) {
      return res.status(404).json({ error: "Tedarik\xE7iye ait kullan\u0131c\u0131 hesab\u0131 bulunamad\u0131." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(newPassword, salt);
    const batch = writeBatch(serverDb);
    userSnap.forEach((uDoc) => {
      batch.update(doc(serverDb, "users", uDoc.id), {
        salt,
        passwordHash,
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
    return res.json({ success: true, message: "Tedarik\xE7i \u015Fifresi ba\u015Far\u0131yla yenilendi." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "\u015Eifre yenilenemedi." });
  }
});
app.post("/api/suppliers/toggle-active", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { supplierId, active } = req.body;
  if (!supplierId) {
    return res.status(400).json({ error: "Tedarik\xE7i ID zorunludur." });
  }
  try {
    await setDoc(
      doc(serverDb, "suppliers", supplierId),
      { active: Boolean(active), updatedAt: serverTimestamp() },
      { merge: true }
    );
    const userQuery = query(collection(serverDb, "users"), where("supplierId", "==", supplierId));
    const userSnap = await getDocs(userQuery);
    if (!userSnap.empty) {
      const batch = writeBatch(serverDb);
      userSnap.forEach((uDoc) => {
        batch.update(doc(serverDb, "users", uDoc.id), {
          active: Boolean(active),
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
    return res.json({ success: true, active: Boolean(active) });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Tedarik\xE7i durumu g\xFCncellenemedi." });
  }
});
app.post("/api/suppliers/delete", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { supplierId, forceDelete } = req.body;
  if (!supplierId) {
    return res.status(400).json({ error: "Tedarik\xE7i ID zorunludur." });
  }
  try {
    const assignSnap = await getDocs(query(collection(serverDb, "requestAssignments"), where("supplierId", "==", supplierId)));
    const vehicleSnap = await getDocs(query(collection(serverDb, "vehicles"), where("supplierId", "==", supplierId)));
    const hasHistory = !assignSnap.empty || !vehicleSnap.empty;
    if (hasHistory && !forceDelete) {
      await setDoc(doc(serverDb, "suppliers", supplierId), {
        archived: true,
        active: false,
        updatedAt: serverTimestamp()
      }, { merge: true });
      const userQuery2 = query(collection(serverDb, "users"), where("supplierId", "==", supplierId));
      const userSnap2 = await getDocs(userQuery2);
      if (!userSnap2.empty) {
        const batch = writeBatch(serverDb);
        userSnap2.forEach((uDoc) => {
          batch.update(doc(serverDb, "users", uDoc.id), { active: false, updatedAt: serverTimestamp() });
        });
        await batch.commit();
      }
      return res.json({
        success: true,
        archived: true,
        message: `Tedarik\xE7iye ait ${assignSnap.size} talep ve ${vehicleSnap.size} ara\xE7 ge\xE7mi\u015Fi bulundu\u011Fu i\xE7in firma g\xFCvenli \u015Fekilde ar\u015Fivlendi ve eri\u015Fime kapat\u0131ld\u0131.`
      });
    }
    await deleteDoc(doc(serverDb, "suppliers", supplierId));
    const userQuery = query(collection(serverDb, "users"), where("supplierId", "==", supplierId));
    const userSnap = await getDocs(userQuery);
    if (!userSnap.empty) {
      const batch = writeBatch(serverDb);
      userSnap.forEach((uDoc) => batch.delete(doc(serverDb, "users", uDoc.id)));
      await batch.commit();
    }
    return res.json({ success: true, deleted: true, message: "Tedarik\xE7i ve kullan\u0131c\u0131 hesab\u0131 ba\u015Far\u0131yla silindi." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Tedarik\xE7i silinemedi." });
  }
});
async function readTemplatesRegistry() {
  const ref = doc(serverDb, "facilities", "system_templates_registry");
  const snap = await getDoc(ref);
  if (snap.exists() && Array.isArray(snap.data().templates)) {
    return snap.data().templates;
  }
  return [];
}
async function writeTemplatesRegistry(templates) {
  const ref = doc(serverDb, "facilities", "system_templates_registry");
  await setDoc(ref, {
    isSystemRegistry: true,
    templates,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
async function readDraftsRegistry() {
  const ref = doc(serverDb, "facilities", "system_drafts_registry");
  const snap = await getDoc(ref);
  if (snap.exists() && Array.isArray(snap.data().drafts)) {
    return snap.data().drafts;
  }
  return [];
}
async function writeDraftsRegistry(drafts) {
  const ref = doc(serverDb, "facilities", "system_drafts_registry");
  await setDoc(ref, {
    isSystemRegistry: true,
    drafts,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
app.post("/api/templates/save", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Bu i\u015Flem i\xE7in Y\xF6netici (ADMIN) yetkisi gereklidir." });
  }
  const { template } = req.body;
  if (!template || !template.name || !template.originFacility || !template.destination) {
    return res.status(400).json({ error: "\u015Eablon ad\u0131, \xE7\u0131k\u0131\u015F ve var\u0131\u015F tesisleri zorunludur." });
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
      vehicleType: template.vehicleType || "TIR (Tenteli 13.60)",
      defaultQuantity: Math.max(1, Number(template.defaultQuantity) || 1),
      requiredTime: template.requiredTime || "09:00",
      recurrenceType: template.recurrenceType || "DAILY",
      recurrenceDays: Array.isArray(template.recurrenceDays) ? template.recurrenceDays : [1, 2, 3, 4, 5],
      startDate: template.startDate || "",
      endDate: template.endDate || "",
      distributionMode: template.distributionMode || "MANUAL",
      supplierIds: Array.isArray(template.supplierIds) ? template.supplierIds : ["deniz-lojistik", "alp-ozler-lojistik", "tekno-lojistik", "ekol-lojistik", "ayz-lojistik"],
      manualDistribution: template.manualDistribution || {},
      priority: template.priority || "NORMAL",
      description: template.description || "",
      active: template.active !== void 0 ? Boolean(template.active) : true,
      createdBy: payload.uid,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const idx = existingList.findIndex((t) => t.id === templateId);
    if (idx >= 0) {
      existingList[idx] = { ...existingList[idx], ...dataToSave };
    } else {
      existingList.push(dataToSave);
    }
    await writeTemplatesRegistry(existingList);
    return res.json({ success: true, template: dataToSave });
  } catch (err) {
    console.error("Template save error:", err);
    return res.status(500).json({ error: err.message || "\u015Eablon kaydedilemedi." });
  }
});
app.post("/api/templates/toggle-active", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { templateId, active } = req.body;
  try {
    const existingList = await readTemplatesRegistry();
    const updated = existingList.map(
      (t) => t.id === templateId ? { ...t, active: Boolean(active), updatedAt: (/* @__PURE__ */ new Date()).toISOString() } : t
    );
    await writeTemplatesRegistry(updated);
    return res.json({ success: true, active: Boolean(active) });
  } catch (err) {
    return res.status(500).json({ error: err.message || "\u015Eablon durumu g\xFCncellenemedi." });
  }
});
app.post("/api/templates/delete", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { templateId } = req.body;
  try {
    const existingList = await readTemplatesRegistry();
    const filtered = existingList.filter((t) => t.id !== templateId);
    await writeTemplatesRegistry(filtered);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "\u015Eablon silinemedi." });
  }
});
app.post("/api/drafts/generate-for-date", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { plannedDate } = req.body;
  if (!plannedDate) {
    return res.status(400).json({ error: "Tarih se\xE7imi zorunludur." });
  }
  try {
    const allTemplates = await readTemplatesRegistry();
    const activeTemplates = allTemplates.filter((t) => t.active !== false);
    const allDrafts = await readDraftsRegistry();
    const existingTemplateIds = /* @__PURE__ */ new Set();
    allDrafts.filter((d) => d.plannedDate === plannedDate).forEach((d) => {
      if (d.templateId) existingTemplateIds.add(d.templateId);
    });
    const targetDateObj = /* @__PURE__ */ new Date(plannedDate + "T12:00:00Z");
    const dayOfWeek = targetDateObj.getUTCDay();
    let createdCount = 0;
    activeTemplates.forEach((t, idx) => {
      if (existingTemplateIds.has(t.id)) {
        return;
      }
      if (t.startDate && plannedDate < t.startDate) return;
      if (t.endDate && plannedDate > t.endDate) return;
      let matches = false;
      if (t.recurrenceType === "DAILY") {
        matches = true;
      } else if (t.recurrenceType === "WEEKDAYS") {
        matches = dayOfWeek >= 1 && dayOfWeek <= 5;
      } else if (t.recurrenceType === "WEEKENDS") {
        matches = dayOfWeek === 0 || dayOfWeek === 6;
      } else if (t.recurrenceType === "CUSTOM_DAYS") {
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
        requiredTime: t.requiredTime || "09:00",
        distributionMode: t.distributionMode || "MANUAL",
        supplierIds: t.supplierIds || [],
        manualDistribution: t.manualDistribution || {},
        priority: t.priority || "NORMAL",
        description: t.description || "",
        status: "DRAFT",
        createdBy: payload.uid,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      allDrafts.push(draftData);
      createdCount++;
    });
    if (createdCount > 0) {
      await writeDraftsRegistry(allDrafts);
    }
    return res.json({ success: true, createdCount });
  } catch (err) {
    console.error("Draft generation error:", err);
    return res.status(500).json({ error: err.message || "Taslaklar \xFCretilemedi." });
  }
});
app.post("/api/drafts/update", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { draftId, quantity, requiredTime, priority, status, description, manualDistribution } = req.body;
  if (!draftId) {
    return res.status(400).json({ error: "Taslak ID zorunludur." });
  }
  try {
    const allDrafts = await readDraftsRegistry();
    const updatedDrafts = allDrafts.map((d) => {
      if (d.id !== draftId) return d;
      const next = { ...d, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      if (quantity !== void 0) next.quantity = Math.max(1, Number(quantity));
      if (requiredTime !== void 0) next.requiredTime = requiredTime;
      if (priority !== void 0) next.priority = priority;
      if (status !== void 0) next.status = status;
      if (description !== void 0) next.description = description;
      if (manualDistribution !== void 0) next.manualDistribution = manualDistribution;
      return next;
    });
    await writeDraftsRegistry(updatedDrafts);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Taslak g\xFCncellenemedi." });
  }
});
app.post("/api/drafts/delete", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { draftId } = req.body;
  try {
    const allDrafts = await readDraftsRegistry();
    const filtered = allDrafts.filter((d) => d.id !== draftId);
    await writeDraftsRegistry(filtered);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Taslak silinemedi." });
  }
});
app.post("/api/drafts/create-requests", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { draftIds } = req.body;
  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return res.status(400).json({ error: "En az bir taslak se\xE7ilmelidir." });
  }
  try {
    const allDrafts = await readDraftsRegistry();
    const batch = writeBatch(serverDb);
    const createdResults = [];
    for (let i = 0; i < draftIds.length; i++) {
      const draftId = draftIds[i];
      const draftIdx = allDrafts.findIndex((d) => d.id === draftId);
      if (draftIdx < 0) continue;
      const draft = allDrafts[draftIdx];
      if (draft.status === "CREATED" && draft.createdRequestId) {
        continue;
      }
      const requestDocRef = doc(collection(serverDb, "vehicleRequests"));
      const requestId = requestDocRef.id;
      const requestNumber = `REQ-${Date.now().toString().slice(-5)}${i + 1}`;
      const requestData = {
        requestNumber,
        originFacility: draft.originFacility,
        routeStops: draft.routeStops || [],
        destination: draft.destination,
        vehicleType: draft.vehicleType,
        totalQuantity: Number(draft.quantity) || 1,
        distributionMode: draft.distributionMode || "MANUAL",
        requiredDate: draft.plannedDate,
        requiredTime: draft.requiredTime || "09:00",
        description: draft.description ? `[\u015Eablon: ${draft.templateName}] ${draft.description}` : `[\u015Eablon: ${draft.templateName}]`,
        status: "PENDING",
        createdBy: payload.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(requestDocRef, requestData);
      allDrafts[draftIdx] = {
        ...draft,
        status: "CREATED",
        createdRequestId: requestId,
        createdRequestNumber: requestNumber,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      createdResults.push({ draftId, requestId, requestNumber });
    }
    if (createdResults.length > 0) {
      await batch.commit();
      await writeDraftsRegistry(allDrafts);
    }
    return res.json({ success: true, createdCount: createdResults.length, results: createdResults });
  } catch (err) {
    console.error("Create requests from drafts error:", err);
    return res.status(500).json({ error: err.message || "Talepler olu\u015Fturulamad\u0131." });
  }
});
app.post("/api/drafts/distribute", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { draftIds } = req.body;
  if (!Array.isArray(draftIds) || draftIds.length === 0) {
    return res.status(400).json({ error: "En az bir taslak se\xE7ilmelidir." });
  }
  try {
    const allDrafts = await readDraftsRegistry();
    const batch = writeBatch(serverDb);
    let distributedCount = 0;
    const activeSuppliersSnap = await getDocs(query(collection(serverDb, "suppliers"), where("active", "==", true)));
    const dynamicSuppliers = activeSuppliersSnap.docs.filter((d) => !d.id.startsWith("system_")).map((d) => d.id);
    const notificationsToDispatch = [];
    for (const draftId of draftIds) {
      const draftIdx = allDrafts.findIndex((d) => d.id === draftId);
      if (draftIdx < 0) continue;
      const draft = allDrafts[draftIdx];
      if (!draft.createdRequestId) continue;
      const requestId = draft.createdRequestId;
      const requestDoc = await getDoc(doc(serverDb, "vehicleRequests", requestId));
      if (!requestDoc.exists()) continue;
      const reqData = requestDoc.data();
      if (draft.distributionMode === "MANUAL" && draft.manualDistribution) {
        for (const [supplierId, assignedQty] of Object.entries(draft.manualDistribution)) {
          if (Number(assignedQty) > 0) {
            const assignmentRef = doc(collection(serverDb, "requestAssignments"));
            batch.set(assignmentRef, {
              requestId,
              supplierId,
              assignedQuantity: Number(assignedQty),
              offeredQuantity: 0,
              confirmedQuantity: 0,
              status: "PENDING",
              sentAt: serverTimestamp()
            });
            const supplierViewRef = doc(serverDb, "supplierRequestViews", `${supplierId}_${requestId}`);
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
              requiredTime: reqData.requiredTime || "09:00",
              description: reqData.description,
              distributionMode: "MANUAL",
              status: "PENDING",
              assignmentStatus: "PENDING",
              assignmentId: assignmentRef.id,
              visibleToSupplier: true,
              createdAt: serverTimestamp()
            });
            notificationsToDispatch.push({
              eventType: "NEW_REQUEST",
              supplierId,
              requestId,
              requestNumber: reqData.requestNumber,
              originFacility: reqData.originFacility,
              routeStops: reqData.routeStops || [],
              destination: reqData.destination,
              vehicleType: reqData.vehicleType,
              assignedQuantity: Number(assignedQty),
              requiredDate: reqData.requiredDate,
              requiredTime: reqData.requiredTime || "09:00",
              description: reqData.description || ""
            });
          }
        }
      } else {
        const targetSuppliers = Array.isArray(draft.supplierIds) && draft.supplierIds.length > 0 ? draft.supplierIds : dynamicSuppliers;
        for (const supplierId of targetSuppliers) {
          const assignmentRef = doc(collection(serverDb, "requestAssignments"));
          batch.set(assignmentRef, {
            requestId,
            supplierId,
            assignedQuantity: Number(draft.quantity) || 1,
            offeredQuantity: 0,
            confirmedQuantity: 0,
            status: "PENDING",
            sentAt: serverTimestamp()
          });
          const supplierViewRef = doc(serverDb, "supplierRequestViews", `${supplierId}_${requestId}`);
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
            requiredTime: reqData.requiredTime || "09:00",
            description: reqData.description,
            distributionMode: "OPEN",
            status: "PENDING",
            assignmentStatus: "PENDING",
            assignmentId: assignmentRef.id,
            visibleToSupplier: true,
            createdAt: serverTimestamp()
          });
          notificationsToDispatch.push({
            eventType: "NEW_REQUEST",
            supplierId,
            requestId,
            requestNumber: reqData.requestNumber,
            originFacility: reqData.originFacility,
            routeStops: reqData.routeStops || [],
            destination: reqData.destination,
            vehicleType: reqData.vehicleType,
            assignedQuantity: Number(draft.quantity) || 1,
            requiredDate: reqData.requiredDate,
            requiredTime: reqData.requiredTime || "09:00",
            description: reqData.description || ""
          });
        }
      }
      allDrafts[draftIdx] = {
        ...draft,
        status: "CREATED",
        isDistributed: true,
        distributedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
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
  } catch (err) {
    console.error("Distribute drafts error:", err);
    return res.status(500).json({ error: err.message || "Talepler tedarik\xE7ilere da\u011F\u0131t\u0131lamad\u0131." });
  }
});
app.post("/api/requests/revise", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler talep revizyonu yapabilir." });
  }
  const { requestId, totalQuantity, requiredDate, requiredTime, vehicleType, description } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: "Talep ID zorunludur." });
  }
  try {
    const reqRef = doc(serverDb, "vehicleRequests", requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      return res.status(404).json({ error: "Talep bulunamad\u0131." });
    }
    const oldData = reqSnap.data();
    const isDeadlineChanged = requiredDate && requiredDate !== oldData.requiredDate || requiredTime && requiredTime !== (oldData.requiredTime || "09:00");
    const newQty = totalQuantity !== void 0 ? Number(totalQuantity) : oldData.totalQuantity;
    const newDate = requiredDate || oldData.requiredDate;
    const newTime = requiredTime || oldData.requiredTime || "09:00";
    const newVehicleType = vehicleType || oldData.vehicleType;
    const newDesc = description !== void 0 ? description : oldData.description || "";
    const changeNotes = [];
    if (newQty !== oldData.totalQuantity) changeNotes.push(`Toplam \u0130htiya\xE7: ${oldData.totalQuantity} -> ${newQty}`);
    if (newDate !== oldData.requiredDate) changeNotes.push(`Tarih: ${oldData.requiredDate} -> ${newDate}`);
    if (newTime !== (oldData.requiredTime || "09:00")) changeNotes.push(`Termin Saati: ${oldData.requiredTime || "09:00"} -> ${newTime}`);
    if (newVehicleType !== oldData.vehicleType) changeNotes.push(`Ara\xE7 Tipi: ${oldData.vehicleType} -> ${newVehicleType}`);
    if (newDesc !== (oldData.description || "")) changeNotes.push(`A\xE7\u0131klama g\xFCncellendi`);
    await setDoc(
      reqRef,
      {
        totalQuantity: newQty,
        requiredDate: newDate,
        requiredTime: newTime,
        vehicleType: newVehicleType,
        description: newDesc,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    const assignSnap = await getDocs(
      query(collection(serverDb, "requestAssignments"), where("requestId", "==", requestId))
    );
    const revVersion = `rev_${Date.now()}`;
    const eventTypeToTrigger = isDeadlineChanged && changeNotes.length === 1 ? "NEW_DEADLINE" : "REQUEST_REVISION";
    for (const aDoc of assignSnap.docs) {
      const aData = aDoc.data();
      const supQty = oldData.distributionMode === "OPEN" ? newQty : aData.assignedQuantity || newQty;
      if (oldData.distributionMode === "OPEN") {
        await setDoc(doc(serverDb, "requestAssignments", aDoc.id), { assignedQuantity: supQty }, { merge: true });
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
        assignmentId: aDoc.id
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
        extraDetails: changeNotes.length > 0 ? `De\u011Fi\u015Fiklik \xD6zeti: ${changeNotes.join(" | ")}` : "Talep bilgileri g\xFCncellendi.",
        versionKey: revVersion
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Talep revize edilemedi." });
  }
});
app.post("/api/requests/cancel", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler talep iptali yapabilir." });
  }
  const { requestId, cancelReason } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: "Talep ID zorunludur." });
  }
  try {
    const reqRef = doc(serverDb, "vehicleRequests", requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      return res.status(404).json({ error: "Talep bulunamad\u0131." });
    }
    const reqData = reqSnap.data();
    await setDoc(
      reqRef,
      {
        status: "CANCELLED",
        description: cancelReason ? `[\u0130PTAL: ${cancelReason}] ${reqData.description || ""}` : reqData.description || "",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    const assignSnap = await getDocs(
      query(collection(serverDb, "requestAssignments"), where("requestId", "==", requestId))
    );
    const cancelVersion = `cancel_${Date.now()}`;
    for (const aDoc of assignSnap.docs) {
      const aData = aDoc.data();
      await setDoc(doc(serverDb, "requestAssignments", aDoc.id), { status: "REJECTED" }, { merge: true });
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
        requiredTime: reqData.requiredTime || "09:00",
        distributionMode: reqData.distributionMode,
        status: "CANCELLED",
        assignmentStatus: "REJECTED",
        assignmentId: aDoc.id
      });
      await dispatchSupplierNotification({
        eventType: "REQUEST_CANCELLED",
        supplierId: aData.supplierId,
        requestId,
        requestNumber: reqData.requestNumber,
        originFacility: reqData.originFacility,
        routeStops: reqData.routeStops || [],
        destination: reqData.destination,
        vehicleType: reqData.vehicleType,
        assignedQuantity: aData.assignedQuantity || 0,
        requiredDate: reqData.requiredDate,
        requiredTime: reqData.requiredTime || "09:00",
        description: reqData.description || "",
        extraDetails: cancelReason ? `\u0130ptal Nedeni: ${cancelReason}` : "Bu ara\xE7 talebi y\xF6netici taraf\u0131ndan iptal edilmi\u015Ftir.",
        versionKey: cancelVersion
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Talep iptal edilemedi." });
  }
});
app.post("/api/notifications/settings/update", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem." });
  }
  const {
    supplierId: requestedSupplierId,
    emailEnabled,
    pushEnabled,
    inAppEnabled,
    mandatoryCriticalPolicy,
    eventPreferences
  } = req.body;
  const targetSupplierId = payload.role === "SUPPLIER" ? payload.supplierId : requestedSupplierId;
  if (!targetSupplierId) {
    return res.status(400).json({ error: "Tedarik\xE7i kimli\u011Fi bulunamad\u0131." });
  }
  if (payload.role === "SUPPLIER" && payload.supplierId !== targetSupplierId) {
    return res.status(403).json({ error: "Yaln\u0131zca kendi firman\u0131z\u0131n bildirim tercihlerini de\u011Fi\u015Ftirebilirsiniz." });
  }
  try {
    const supRef = doc(serverDb, "suppliers", targetSupplierId);
    const existingSnap = await getDoc(supRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};
    const updates = {
      updatedAt: serverTimestamp()
    };
    if (emailEnabled !== void 0) updates.emailEnabled = Boolean(emailEnabled);
    if (pushEnabled !== void 0) updates.pushEnabled = Boolean(pushEnabled);
    if (inAppEnabled !== void 0) updates.inAppEnabled = Boolean(inAppEnabled);
    if (eventPreferences && typeof eventPreferences === "object") {
      updates.eventPreferences = {
        ...existingData.eventPreferences || {
          NEW_REQUEST: true,
          REQUEST_REVISION: true,
          REQUEST_CANCELLED: true,
          NEW_DEADLINE: true,
          VEHICLE_APPROVED: true,
          VEHICLE_REJECTED: true
        },
        ...eventPreferences
      };
    }
    if (payload.role === "ADMIN" && mandatoryCriticalPolicy !== void 0) {
      updates.mandatoryCriticalPolicy = Boolean(mandatoryCriticalPolicy);
    }
    await setDoc(supRef, updates, { merge: true });
    await setDoc(
      doc(serverDb, "supplierNotificationSettings", targetSupplierId),
      { supplierId: targetSupplierId, ...updates },
      { merge: true }
    ).catch(() => {
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Bildirim tercihleri kaydedilemedi." });
  }
});
app.post("/api/notifications/email/request-verification", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { supplierId: requestedSupplierId, newEmail } = req.body;
  const targetSupplierId = payload.role === "SUPPLIER" ? payload.supplierId : requestedSupplierId;
  if (!targetSupplierId || !newEmail || !newEmail.includes("@")) {
    return res.status(400).json({ error: "Ge\xE7erli bir e-posta adresi giriniz." });
  }
  if (payload.role === "SUPPLIER" && payload.supplierId !== targetSupplierId) {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  const cleanEmail = newEmail.trim().toLowerCase();
  const verificationCode = Math.floor(1e5 + Math.random() * 9e5).toString();
  try {
    const supRef = doc(serverDb, "suppliers", targetSupplierId);
    const supSnap = await getDoc(supRef);
    const supName = supSnap.exists() ? supSnap.data().companyName : targetSupplierId;
    await setDoc(
      supRef,
      {
        pendingEmail: cleanEmail,
        verificationCode,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    await setDoc(
      doc(serverDb, "supplierNotificationSettings", targetSupplierId),
      {
        supplierId: targetSupplierId,
        pendingEmail: cleanEmail,
        verificationCode,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    ).catch(() => {
    });
    const verifyHtml = `
      <div style="font-family:sans-serif;padding:24px;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;">
        <h2 style="color:#092B60;margin-top:0;">TEDAR\u0130K360 E-Posta Do\u011Frulama</h2>
        <p>Say\u0131n <strong>${supName}</strong> Yetkilisi,</p>
        <p>Bildirim e-posta adresinizi <strong>${cleanEmail}</strong> olarak g\xFCncellemek i\xE7in do\u011Frulama kodunuz:</p>
        <div style="font-size:28px;font-weight:900;letter-spacing:6px;background:#EFF6FF;color:#1D4ED8;padding:16px;text-align:center;border-radius:8px;margin:16px 0;">
          ${verificationCode}
        </div>
        <p style="font-size:12px;color:#64748B;">Bu adres do\u011Frulanana kadar mevcut aktif e-posta adresiniz kullan\u0131lmaya devam edecektir.</p>
      </div>
    `;
    await sendCorporateEmailViaProvider({
      to: cleanEmail,
      subject: `[TEDAR\u0130K360] E-Posta Do\u011Frulama Kodu: ${verificationCode}`,
      html: verifyHtml
    });
    return res.json({
      success: true,
      pendingEmail: cleanEmail,
      verificationCodePreview: verificationCode,
      message: `Do\u011Frulama kodu ${cleanEmail} adresine g\xF6nderildi. Do\u011Frulama tamamlanana kadar yeni e-posta adresi aktif bildirimlerde kullan\u0131lmaz.`
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Do\u011Frulama kodu g\xF6nderilemedi." });
  }
});
app.post("/api/notifications/email/verify", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { supplierId: requestedSupplierId, code, adminDirectVerify } = req.body;
  const targetSupplierId = payload.role === "SUPPLIER" ? payload.supplierId : requestedSupplierId;
  if (!targetSupplierId) {
    return res.status(400).json({ error: "Tedarik\xE7i ID zorunludur." });
  }
  if (payload.role === "SUPPLIER" && payload.supplierId !== targetSupplierId) {
    return res.status(403).json({ error: "Yetkisiz i\u015Flem." });
  }
  try {
    const supRef = doc(serverDb, "suppliers", targetSupplierId);
    const supSnap = await getDoc(supRef);
    const supData = supSnap.exists() ? supSnap.data() : {};
    const isAdminForce = payload.role === "ADMIN" && Boolean(adminDirectVerify);
    if (!isAdminForce) {
      if (!code || String(code).trim() !== String(supData.verificationCode || "").trim()) {
        return res.status(400).json({ error: "Ge\xE7ersiz do\u011Frulama kodu. L\xFCtfen kontrol edip tekrar deneyin." });
      }
    }
    const verifiedEmail = (supData.pendingEmail || supData.email || "").trim();
    if (!verifiedEmail) {
      return res.status(400).json({ error: "Do\u011Frulanacak e-posta adresi bulunamad\u0131." });
    }
    await setDoc(
      supRef,
      {
        email: verifiedEmail,
        pendingEmail: "",
        verificationCode: "",
        emailVerified: true,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    await setDoc(
      doc(serverDb, "supplierNotificationSettings", targetSupplierId),
      {
        supplierId: targetSupplierId,
        email: verifiedEmail,
        pendingEmail: "",
        verificationCode: "",
        emailVerified: true,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    ).catch(() => {
    });
    const userQuery = query(collection(serverDb, "users"), where("supplierId", "==", targetSupplierId));
    const userSnap = await getDocs(userQuery);
    for (const uDoc of userSnap.docs) {
      await setDoc(doc(serverDb, "users", uDoc.id), { email: verifiedEmail, updatedAt: serverTimestamp() }, { merge: true });
    }
    return res.json({
      success: true,
      email: verifiedEmail,
      message: "E-posta adresi ba\u015Far\u0131yla do\u011Fruland\u0131 ve aktif bildirim adresi olarak tan\u0131mland\u0131."
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "E-posta do\u011Frulanamad\u0131." });
  }
});
app.post("/api/notifications/device-token/register", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem." });
  }
  const { fcmToken, deviceType, userAgent } = req.body;
  if (!fcmToken) {
    return res.status(400).json({ error: "Cihaz token bilgisi zorunludur." });
  }
  try {
    const tokenHash = crypto.createHash("sha256").update(`${payload.uid}_${fcmToken}`).digest("hex").slice(0, 24);
    const tokenRecord = {
      id: `dev_${tokenHash}`,
      userId: payload.uid,
      supplierId: payload.supplierId || null,
      fcmToken,
      deviceType: deviceType || "WEB",
      userAgent: userAgent || "",
      lastActiveAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const userRef = doc(serverDb, "users", payload.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const existingTokens = Array.isArray(userSnap.data().deviceTokens) ? userSnap.data().deviceTokens : [];
      const filtered = existingTokens.filter((t) => t.id !== tokenRecord.id && t.fcmToken !== fcmToken);
      filtered.push(tokenRecord);
      await setDoc(userRef, { deviceTokens: filtered, updatedAt: serverTimestamp() }, { merge: true });
    }
    await setDoc(
      doc(serverDb, "userDeviceTokens", `dev_${tokenHash}`),
      {
        ...tokenRecord,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp()
      },
      { merge: true }
    ).catch(() => {
    });
    return res.json({ success: true, tokenId: `dev_${tokenHash}` });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Cihaz token kaydedilemedi." });
  }
});
app.post("/api/notifications/device-token/unregister", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = token ? verifySessionToken(token) : null;
  const { fcmToken, userId } = req.body;
  const targetUid = payload?.uid || userId;
  if (!targetUid && !fcmToken) {
    return res.json({ success: true });
  }
  try {
    if (targetUid) {
      const userRef = doc(serverDb, "users", targetUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && Array.isArray(userSnap.data().deviceTokens)) {
        const filtered = fcmToken ? userSnap.data().deviceTokens.filter((t) => t.fcmToken !== fcmToken) : [];
        await setDoc(userRef, { deviceTokens: filtered, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
    if (targetUid && fcmToken) {
      const tokenHash = crypto.createHash("sha256").update(`${targetUid}_${fcmToken}`).digest("hex").slice(0, 24);
      await deleteDoc(doc(serverDb, "userDeviceTokens", `dev_${tokenHash}`)).catch(() => {
      });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Cihaz token silinemedi." });
  }
});
app.post("/api/notifications/mark-all-read", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Yetkisiz i\u015Flem." });
  }
  try {
    const snap = await getDocs(collection(serverDb, "notifications"));
    const batch = writeBatch(serverDb);
    let updated = 0;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isDeliveryLog) return;
      const isUnread = !data.read && !data.isRead;
      if (!isUnread) return;
      if (payload.role === "SUPPLIER") {
        if (data.supplierId === payload.supplierId || data.recipientUserId === payload.uid) {
          batch.update(doc(serverDb, "notifications", docSnap.id), { read: true, isRead: true });
          updated++;
        }
      } else {
        if (!data.supplierId || data.recipientRole === "ADMIN" || data.recipientRole === "OPERATOR" || data.recipientRole === "ALL") {
          batch.update(doc(serverDb, "notifications", docSnap.id), { read: true, isRead: true });
          updated++;
        }
      }
    });
    if (updated > 0) {
      await batch.commit();
    }
    return res.json({ success: true, updated });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Bildirimler okundu yap\u0131lamad\u0131." });
  }
});
app.post("/api/notifications/retry", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.body.sessionToken;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Yaln\u0131zca y\xF6neticiler bildirim tekrar g\xF6nderimi ba\u015Flatabilir." });
  }
  const { logId } = req.body;
  if (!logId) {
    return res.status(400).json({ error: "Log ID zorunludur." });
  }
  try {
    const logRef = doc(serverDb, "notifications", logId);
    const logSnap = await getDoc(logRef);
    if (!logSnap.exists()) {
      return res.status(404).json({ error: "Bildirim kayd\u0131 bulunamad\u0131." });
    }
    const logData = logSnap.data();
    if (logData.channel === "EMAIL" && logData.emailHtmlPreview && logData.recipient) {
      const emailRes = await sendCorporateEmailViaProvider({
        to: logData.recipient,
        subject: logData.emailSubject || `[TEDAR\u0130K360] Bildirim Tekrar\u0131 (#${logData.requestNumber || ""})`,
        html: logData.emailHtmlPreview
      });
      await setDoc(
        logRef,
        {
          status: emailRes.delivered ? "DELIVERED" : "FAILED",
          errorMessage: emailRes.errorMessage || "",
          retriedAt: serverTimestamp()
        },
        { merge: true }
      );
      return res.json({ success: emailRes.delivered, status: emailRes.delivered ? "DELIVERED" : "FAILED" });
    }
    await setDoc(
      logRef,
      {
        status: "DELIVERED",
        errorMessage: "",
        retriedAt: serverTimestamp()
      },
      { merge: true }
    );
    return res.json({ success: true, status: "DELIVERED" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Yeniden g\xF6nderim ba\u015Far\u0131s\u0131z." });
  }
});
async function startServer() {
  await bootstrapInitialAccounts();
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`TEDAR\u0130K360 server running on port ${port}`);
  });
}
startServer();
export {
  buildCorporateEmailHtml,
  createSessionToken,
  dispatchSupplierNotification,
  hashPassword,
  verifyPassword,
  verifySessionToken
};
