import { DailyRequestTemplate, DailyRequestDraft } from '../types';

function getSessionToken(): string | null {
  return localStorage.getItem('tedarik360_session_token');
}

export async function saveDailyRequestTemplate(template: Partial<DailyRequestTemplate>): Promise<DailyRequestTemplate> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/templates/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ template }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Şablon kaydedilemedi.');
  return data.template;
}

export async function toggleTemplateActive(templateId: string, active: boolean): Promise<boolean> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/templates/toggle-active', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ templateId, active }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Şablon durumu güncellenemedi.');
  return data.active;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/templates/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ templateId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Şablon silinemedi.');
}

export async function generateDraftsForDate(plannedDate: string): Promise<number> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/drafts/generate-for-date', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plannedDate }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Taslaklar üretilemedi.');
  return data.createdCount;
}

export async function updateDailyDraft(params: {
  draftId: string;
  quantity?: number;
  requiredTime?: string;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  status?: 'DRAFT' | 'REVIEWED' | 'CREATED' | 'CANCELLED';
  description?: string;
  manualDistribution?: Record<string, number>;
}): Promise<void> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/drafts/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Taslak güncellenemedi.');
}

export async function deleteDailyDraft(draftId: string): Promise<void> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/drafts/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ draftId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Taslak silinemedi.');
}

export async function createRequestsFromDrafts(draftIds: string[]): Promise<number> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/drafts/create-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ draftIds }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Talepler oluşturulamadı.');
  return data.createdCount;
}

export async function distributeDraftsToSuppliers(draftIds: string[]): Promise<number> {
  const token = getSessionToken();
  if (!token) throw new Error('Oturum açılmamış.');

  const res = await fetch('/api/drafts/distribute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ draftIds }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tedarikçilere dağıtılamadı.');
  return data.distributedCount;
}
