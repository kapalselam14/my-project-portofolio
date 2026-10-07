import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { COLLECTIONS } from '../../database/paths.js';

export type AuditCategory =
  'Members' | 'Activities' | 'Appeals' | 'Reports' | 'Broadcasts' | 'Sports' | 'Templates';

export type AuditAction =
  | 'member.status_change'
  | 'member.delete'
  | 'activity.status_change'
  | 'activity.delete'
  | 'appeal.approve'
  | 'appeal.reject'
  | 'report.resolve'
  | 'report.dismiss'
  | 'broadcast.create'
  | 'broadcast.update'
  | 'broadcast.send'
  | 'broadcast.delete'
  | 'sport.update'
  | 'sport.replace'
  | 'template.update';

const AUDIT_CATEGORIES: readonly AuditCategory[] = [
  'Members',
  'Activities',
  'Appeals',
  'Reports',
  'Broadcasts',
  'Sports',
  'Templates',
];

export function isAuditCategory(value: unknown): value is AuditCategory {
  return typeof value === 'string' && (AUDIT_CATEGORIES as readonly string[]).includes(value);
}

export type LogAdminActionInput = {
  category: AuditCategory;
  action: AuditAction;
  adminUid: string;
  /** From `req.auth.token.email` — no extra Admin SDK lookup needed. */
  adminEmail?: string | null;
  description: string;
  targetId?: string | null;
  targetLabel?: string;
  /** Pre-mutation snapshot — status changes and deletes only. */
  before?: Record<string, unknown> | null;
  /** Post-mutation snapshot. */
  after?: Record<string, unknown> | null;
  metadata?: Record<string, string>;
};

export type AuditLogView = {
  id: string;
  category: AuditCategory;
  action: AuditAction;
  adminUid: string;
  adminEmail: string | null;
  description: string;
  targetId: string | null;
  targetLabel: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, string>;
  createdAt: string;
};

/** Best-effort audit-trail write for an admin mutation. */
export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  // Persist a normalized audit row so admin mutations share one consistent history format.
  try {
    await firestore
      .collection(COLLECTIONS.adminActions)
      .doc()
      .set({
        category: input.category,
        action: input.action,
        adminUid: input.adminUid,
        adminEmail: input.adminEmail ?? null,
        description: input.description,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? '',
        before: input.before ?? null,
        after: input.after ?? null,
        metadata: input.metadata ?? {},
        createdAt: Timestamp.now(),
      });
  } catch (error) {
    console.error('[audit] failed to write admin action log', error);
  }
}

export type ListAuditLogInput = {
  category?: AuditCategory;
  adminUid?: string;
  limit?: number;
};

/** Newest-first audit-log listing. */
export async function listAuditLog(input: ListAuditLogInput = {}): Promise<AuditLogView[]> {
  // Apply optional filters and return newest actions first for the admin audit page.
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  let query: FirebaseFirestore.Query = firestore.collection(COLLECTIONS.adminActions);
  if (input.category !== undefined) {
    query = query.where('category', '==', input.category);
  }
  const snap = await query.limit(limit).get();
  let views = snap.docs.map((doc) => toView(doc.id, doc.data()));
  if (input.adminUid !== undefined) {
    views = views.filter((v) => v.adminUid === input.adminUid);
  }
  views.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return views;
}

function toView(id: string, data: FirebaseFirestore.DocumentData): AuditLogView {
  return {
    id,
    category: data.category,
    action: data.action,
    adminUid: typeof data.adminUid === 'string' ? data.adminUid : '',
    adminEmail: typeof data.adminEmail === 'string' ? data.adminEmail : null,
    description: typeof data.description === 'string' ? data.description : '',
    targetId: typeof data.targetId === 'string' ? data.targetId : null,
    targetLabel: typeof data.targetLabel === 'string' ? data.targetLabel : '',
    before: data.before ?? null,
    after: data.after ?? null,
    metadata: data.metadata ?? {},
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
  };
}

function toIso(value: unknown): string | null {
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}
