/** Sports service — database-backed master sports list (Firestore `sports`). */
import { apiFetch } from './api';
import type { SportConfig } from '../types/sports';

export type { SportConfig };

export async function fetchSports(): Promise<SportConfig[]> {
  const res = await apiFetch<SportConfig[]>('/api/admin/sports');
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export interface SportFlagPatch {
  enabled?: boolean;
  showInFilter?: boolean;
  showInOnboarding?: boolean;
  canHost?: boolean;
}

export async function updateSport(id: string, patch: SportFlagPatch): Promise<SportConfig> {
  // Persist a partial toggle change and return the server's updated sport configuration.
  const res = await apiFetch<SportConfig>(`/api/admin/sports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

/** Atomic publish of the whole list (the page's "Publish Changes" flow). */
export async function replaceSports(sports: SportConfig[]): Promise<SportConfig[]> {
  const res = await apiFetch<SportConfig[]>('/api/admin/sports', {
    method: 'PUT',
    body: JSON.stringify({
      sports: sports.map((s) => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        enabled: s.enabled,
        showInFilter: s.showInFilter,
        showInOnboarding: s.showInOnboarding,
        canHost: s.canHost,
        sortOrder: s.sortOrder,
      })),
    }),
  });
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}
