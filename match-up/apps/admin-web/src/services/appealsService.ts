/** Appeals service — database-backed (Firestore `appeals` via api-server). */
import { apiFetch } from './api';
import type { Appeal, AppealStatus, AppealType } from '../types/appeals';

export type { Appeal, AppealStatus, AppealType };

const TO_BACKEND: Record<AppealType, string> = {
  Suspension: 'suspension',
  'Activity Removal': 'activity_removal',
  'Account Ban': 'account_ban',
  'Content Removal': 'content_removal',
};

const FROM_BACKEND: Record<string, AppealType> = {
  suspension: 'Suspension',
  activity_removal: 'Activity Removal',
  account_ban: 'Account Ban',
  content_removal: 'Content Removal',
};

const FROM_STATUS: Record<string, AppealStatus> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

interface AppealView {
  id: string;
  appellantUid: string;
  userName: string;
  userEmail: string;
  userPhotoUrl?: string;
  type: string;
  originalAction: string;
  statement: string;
  relatedId: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}

// Map backend enum values and nullable fields into the model consumed by admin pages.
function toAppeal(view: AppealView): Appeal {
  return {
    id: view.id,
    userId: view.appellantUid,
    userName: view.userName,
    userAvatarSeed: view.appellantUid,
    userPhotoUrl: view.userPhotoUrl,
    userEmail: view.userEmail,
    type: FROM_BACKEND[view.type] ?? 'Suspension',
    originalAction: view.originalAction,
    statement: view.statement,
    status: FROM_STATUS[view.status] ?? 'Pending',
    createdAt: view.createdAt ?? '',
    resolvedAt: view.decidedAt ?? undefined,
    adminResponse: view.adminNote ?? undefined,
    relatedId: view.relatedId ?? undefined,
  };
}

export async function fetchAppeals(status: AppealStatus = 'Pending'): Promise<Appeal[]> {
  // Convert the UI status label before building the backend query parameter.
  const backendStatus =
    status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : 'pending';
  const res = await apiFetch<AppealView[]>(`/api/admin/appeals?status=${backendStatus}`);
  if (!res.ok) throw new Error(res.error.message);
  return res.data.map(toAppeal);
}

export type AppealDecision = 'approve' | 'reject';

export async function decideAppeal(
  id: string,
  decision: AppealDecision,
  response: string,
): Promise<Appeal> {
  // Use the selected decision in the endpoint and send the admin response as its note.
  const action = decision === 'approve' ? 'approve' : 'reject';
  const res = await apiFetch<AppealView>(`/api/admin/appeals/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ note: response }),
  });
  if (!res.ok) throw new Error(res.error.message);
  return toAppeal(res.data);
}

export { TO_BACKEND };
