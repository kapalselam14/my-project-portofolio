/** Audit log service — database-backed (Firestore `adminActions` via api-server). */
import { apiFetch } from './api';
import type { AuditAction, AuditCategory, AuditLogEntry } from '../types/auditLog';

export type { AuditAction, AuditCategory, AuditLogEntry };

interface AuditLogEntryView {
  id: string;
  category: string;
  action: string;
  adminUid: string;
  adminEmail: string | null;
  description: string;
  targetId: string | null;
  targetLabel: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, string>;
  createdAt: string;
}

// Convert nullable wire fields into the stable entry shape used by the audit page.
function toAuditLogEntry(view: AuditLogEntryView): AuditLogEntry {
  return {
    id: view.id,
    category: view.category as AuditCategory,
    action: view.action as AuditAction,
    adminUid: view.adminUid,
    adminEmail: view.adminEmail,
    description: view.description,
    targetId: view.targetId,
    targetLabel: view.targetLabel,
    before: view.before,
    after: view.after,
    metadata: view.metadata ?? {},
    createdAt: view.createdAt,
  };
}

export interface FetchAuditLogParams {
  category?: AuditCategory;
  adminUid?: string;
  limit?: number;
}

export async function fetchAuditLog(params: FetchAuditLogParams = {}): Promise<AuditLogEntry[]> {
  // Add only supplied filters so an empty parameter object requests the default log window.
  const query = new URLSearchParams();
  if (params.category !== undefined) query.set('category', params.category);
  if (params.adminUid !== undefined) query.set('adminUid', params.adminUid);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();

  const res = await apiFetch<AuditLogEntryView[]>(`/api/admin/audit-log${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(res.error.message);
  return res.data.map(toAuditLogEntry);
}
