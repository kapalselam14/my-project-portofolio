/** Reports / moderation service — database-backed (Firestore `reports`). */
import { apiFetch } from './api';
import type { Report, ReportStatus } from '../types/reports';

export type { Report, ReportStatus };
export type ReportAction = 'resolve' | 'dismiss';

export async function fetchReports(
  status?: 'pending' | 'resolved' | 'dismissed',
): Promise<Report[]> {
  // Omit the query parameter when callers need reports across all statuses.
  const params = status != null ? `?status=${status}` : '';
  const res = await apiFetch<Report[]>(`/api/reports${params}`);
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export async function reportAction(id: string, action: ReportAction, note?: string): Promise<void> {
  // Send the moderation outcome and optional admin note to the corresponding report endpoint.
  const res = await apiFetch<void>(`/api/reports/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(res.error.message);
}
