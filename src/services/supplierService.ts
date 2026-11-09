import { Supplier } from '../types';

function getSessionToken(): string | null {
  return localStorage.getItem('tedarik360_session_token');
}

export interface CreateSupplierInput {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address?: string;
  taxNumber?: string;
  username: string;
  password: string;
  description?: string;
  active?: boolean;
}

export interface UpdateSupplierInput {
  supplierId: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  description?: string;
  active?: boolean;
}

export async function createSupplier(input: CreateSupplierInput): Promise<{ supplier: Supplier; user: any }> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/suppliers/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tedarikçi oluşturulamadı.');
  return data;
}

export async function updateSupplier(input: UpdateSupplierInput): Promise<void> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/suppliers/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tedarikçi bilgileri güncellenemedi.');
}

export async function resetSupplierPassword(supplierId: string, newPassword: string): Promise<string> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/suppliers/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ supplierId, newPassword }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Şifre sıfırlanamadı.');
  return data.message;
}

export async function toggleSupplierActive(supplierId: string, active: boolean): Promise<boolean> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/suppliers/toggle-active', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ supplierId, active }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tedarikçi durumu güncellenemedi.');
  return data.active;
}

export async function deleteOrArchiveSupplier(
  supplierId: string,
  forceDelete: boolean = false
): Promise<{ success: boolean; archived?: boolean; deleted?: boolean; message: string }> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/suppliers/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ supplierId, forceDelete }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tedarikçi silinemedi.');
  return data;
}
