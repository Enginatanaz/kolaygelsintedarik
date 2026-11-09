import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Supplier, Facility } from '../types';

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'deniz-lojistik',
    companyName: 'Deniz Lojistik',
    contactPerson: 'Hakan Deniz',
    phone: '+90 532 100 0001',
    email: 'operasyon@denizlojistik.com',
    active: true,
    createdAt: null,
  },
  {
    id: 'alp-ozler-lojistik',
    companyName: 'Alp Özler Lojistik',
    contactPerson: 'Murat Özler',
    phone: '+90 532 200 0002',
    email: 'operasyon@alpozler.com',
    active: true,
    createdAt: null,
  },
  {
    id: 'tekno-lojistik',
    companyName: 'Tekno Lojistik',
    contactPerson: 'Serkan Tekin',
    phone: '+90 532 300 0003',
    email: 'filo@teknolojistik.com',
    active: true,
    createdAt: null,
  },
  {
    id: 'ekol-lojistik',
    companyName: 'Ekol Lojistik',
    contactPerson: 'Cem Kaya',
    phone: '+90 532 400 0004',
    email: 'tedarik@ekol.com',
    active: true,
    createdAt: null,
  },
  {
    id: 'ayz-lojistik',
    companyName: 'Ayz Lojistik',
    contactPerson: 'Ayz Lojistik Yetkilisi',
    phone: '+90 532 500 0005',
    email: 'operasyon@ayzlojistik.com',
    active: true,
    createdAt: null,
  },
];

export const INITIAL_FACILITIES: Facility[] = [
  { id: 'ankara-tm', facilityName: 'ANKARA TM', city: 'Ankara', active: true },
  { id: 'avrupa-tm', facilityName: 'AVRUPA TM', city: 'İstanbul', active: true },
  { id: 'izmir-tm', facilityName: 'İZMİR TM', city: 'İzmir', active: true },
  { id: 'marmara-tm', facilityName: 'MARMARA TM', city: 'Kocaeli', active: true },
  { id: 'erzurum-tm', facilityName: 'ERZURUM TM', city: 'Erzurum', active: true },
  { id: 'bursa-tm', facilityName: 'BURSA TM', city: 'Bursa', active: true },
  { id: 'afyon-tm', facilityName: 'AFYON TM', city: 'Afyonkarahisar', active: true },
  { id: 'adana-tm', facilityName: 'ADANA TM', city: 'Adana', active: true },
  { id: 'diyarbakir-tm', facilityName: 'DİYARBAKIR TM', city: 'Diyarbakır', active: true },
  { id: 'samsun-tm', facilityName: 'SAMSUN TM', city: 'Samsun', active: true },
  { id: 'antalya-tm', facilityName: 'ANTALYA TM', city: 'Antalya', active: true },
  { id: 'konya-tm', facilityName: 'KONYA TM', city: 'Konya', active: true },
  { id: 'gaziantep-tm', facilityName: 'GAZİANTEP TM', city: 'Gaziantep', active: true },
  { id: 'kayseri-tm', facilityName: 'KAYSERİ TM', city: 'Kayseri', active: true },
  { id: 'kocaeli-tm', facilityName: 'KOCAELİ TM', city: 'Kocaeli', active: true },
  { id: 'aksaray-tm', facilityName: 'AKSARAY TM', city: 'Aksaray', active: true },
  { id: 'bursa-beylikduzu', facilityName: 'BURSA BEYLİKDÜZÜ', city: 'Bursa', active: true },
  { id: 'netlog-ankara', facilityName: 'NETLOG - ANKARA', city: 'Ankara', active: true },
  { id: 'marmara-tm-kocaeli', facilityName: 'MARMARA TM - KOCAELİ', city: 'Kocaeli', active: true },
  { id: 'xsa8-amazon-akyurt', facilityName: 'XSA8 AMAZON (AKYURT)', city: 'Ankara', active: true },
  { id: 'gebze-tm', facilityName: 'GEBZE TM', city: 'Kocaeli', active: true },
  { id: 'van', facilityName: 'VAN', city: 'Van', active: true },
  { id: 'merzifon', facilityName: 'MERZİFON', city: 'Amasya', active: true },
  { id: 'trabzon', facilityName: 'TRABZON', city: 'Trabzon', active: true },
];

export async function bootstrapSystemData() {
  try {
    // Check if suppliers exist
    const suppliersSnapshot = await getDocs(collection(db, 'suppliers'));
    if (suppliersSnapshot.empty) {
      for (const sup of INITIAL_SUPPLIERS) {
        await setDoc(doc(db, 'suppliers', sup.id), {
          ...sup,
          createdAt: serverTimestamp(),
        });
      }
    }

    // Check existing facilities to avoid duplicates
    const facilitiesSnapshot = await getDocs(collection(db, 'facilities'));
    const existingNames = new Set<string>();
    facilitiesSnapshot.forEach((d) => {
      const data = d.data() as Facility;
      if (data.facilityName) {
        existingNames.add(data.facilityName.trim().toUpperCase());
      }
    });

    for (const fac of INITIAL_FACILITIES) {
      const normalizedName = fac.facilityName.trim().toUpperCase();
      if (!existingNames.has(normalizedName)) {
        await setDoc(doc(db, 'facilities', fac.id), {
          ...fac,
          createdAt: serverTimestamp(),
        });
        existingNames.add(normalizedName);
      }
    }
  } catch (error) {
    console.warn('Bootstrap note (safe if permissions restricted):', error);
  }
}
