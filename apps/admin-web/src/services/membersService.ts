/** Members service — database-backed (Firestore `users` via api-server). */
import { apiFetch } from './api';
import type { Member, MemberStatus } from '../types/members';

export type { Member, MemberStatus };

interface AdminMemberView {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  status: 'active' | 'suspended';
  createdAt: string | null;
  sports: { sport: string; level: string }[];
  rating: number;
  activitiesCount?: number;
  hostedCount?: number;
}

// Fill UI-only fields and translate backend status values into the member page model.
function toMember(view: AdminMemberView): Member {
  const name =
    view.displayName && view.displayName.trim().length > 0
      ? view.displayName
      : (view.email.split('@')[0] ?? view.uid);
  return {
    id: view.uid,
    name,
    username: `@${view.uid.slice(0, 8)}`,
    email: view.email,
    role: 'Player',
    status: view.status === 'suspended' ? 'Suspended' : 'Active',
    sports: Array.isArray(view.sports)
      ? view.sports.filter((s) => typeof s.sport === 'string' && s.sport.length > 0)
      : [],
    joinedDate: view.createdAt ?? '',
    activitiesJoined: view.activitiesCount ?? 0,
    activitiesHosted: view.hostedCount ?? 0,
    rating: typeof view.rating === 'number' ? view.rating : 0,
    avatarSeed: view.uid,
    photoUrl: view.photoUrl,
  };
}

export async function fetchMembers(): Promise<Member[]> {
  // Ask for the full collection (API default is 20): the table paginates client-side.
  const res = await apiFetch<AdminMemberView[]>('/api/admin/members?limit=1000');
  if (!res.ok) throw new Error(res.error.message);
  return res.data.map(toMember);
}

export interface MembersSummary {
  total: number;
  active: number;
  suspended: number;
}

// Collection-wide totals for the header cards (cheap counts; the list itself is fully loaded).
export async function fetchMembersSummary(): Promise<MembersSummary> {
  const res = await apiFetch<MembersSummary>('/api/admin/members/summary');
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export async function fetchMember(id: string): Promise<Member> {
  const res = await apiFetch<AdminMemberView>(`/api/admin/members/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(res.error.message);
  return toMember(res.data);
}

function toBackendStatus(status: MemberStatus): 'active' | 'suspended' {
  // Keep the API's lowercase values separate from the title-case labels used in the UI.
  return status === 'Suspended' ? 'suspended' : 'active';
}

export async function updateMemberStatus(id: string, status: MemberStatus): Promise<void> {
  const res = await apiFetch<void>(`/api/admin/members/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: toBackendStatus(status) }),
  });
  if (!res.ok) throw new Error(res.error.message);
}

export async function deleteMember(id: string): Promise<void> {
  const res = await apiFetch<void>(`/api/admin/members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(res.error.message);
}
