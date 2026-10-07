/** Notification-templates service — database-backed (Firestore `notifTemplates`). */
import { apiFetch } from './api';
import type { NotifTemplate } from '../types/templates';

export type { NotifTemplate };

export async function fetchTemplates(): Promise<NotifTemplate[]> {
  const res = await apiFetch<NotifTemplate[]>('/api/admin/templates');
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export interface TemplatePatch {
  title?: string;
  body?: string;
  enabled?: boolean;
}

export async function updateTemplate(id: string, patch: TemplatePatch): Promise<NotifTemplate> {
  // Apply only editable template fields and return the canonical updated record.
  const res = await apiFetch<NotifTemplate>(`/api/admin/templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}
