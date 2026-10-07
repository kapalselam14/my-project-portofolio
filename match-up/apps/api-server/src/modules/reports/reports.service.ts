import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { activityDocPath, userDocPath } from '../../database/paths.js';
import { logAdminAction } from '../admin/audit.service.js';
import { getPublicUserProfile } from '../users/users.service.js';

export type ReportTargetType = 'user' | 'activity';

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

/** Admin-web category bucket shown on the triage board. */
export type ReportCategory =
  'Harassment' | 'Spam' | 'Policy Breach' | 'Fraud' | 'Inappropriate Content' | 'Other';

export type SubmitReportInput = {
  reporterId: string;
  targetId: string;
  targetType: ReportTargetType;
  reason: string;
  details?: string;
  /** Firebase Storage download URLs for reporter-attached evidence photos. */
  evidenceUrls?: string[];
};

export type SubmitReportResult = {
  reportId: string;
  /**
   * True when this report pushed the target over the auto-hide
   * threshold (see `AUTO_HIDE_DISTINCT_REPORTERS`) and the activity
   * was flipped to `removed`. The mobile client can surface a
   * "thanks, hidden pending review" message off this flag.
   */
  autoHidden: boolean;
};

export type ReportRecord = {
  reporterId: string;
  targetId: string;
  targetType: ReportTargetType;
  reason: string;
  details?: string;
  /** Firebase Storage download URLs for reporter-attached evidence photos. */
  evidenceUrls?: string[];
  status: ReportStatus;
  createdAt: FirebaseFirestore.Timestamp;
  adminNote?: string;
  resolvedAt?: FirebaseFirestore.Timestamp;
  resolvedBy?: string;
  /** Set when the auto-hide threshold flipped the target. */
  autoHidden?: boolean;
};

/**
 * Enriched row for the admin triage board. Field names match the
 * admin-web `Report` type 1:1 so the service can return it untouched.
 */
export type AdminReportView = {
  id: string;
  reporter: string;
  reporterAvatarSeed: string;
  target: string;
  targetType: ReportTargetType;
  reason: string;
  category: ReportCategory;
  activityTitle: string;
  sport: string;
  status: 'Pending' | 'Resolved' | 'Dismissed';
  createdAt: string;
  adminNote?: string;
  resolvedAt?: string;
};

const MAX_REASON_LENGTH = 200;
const MAX_DETAILS_LENGTH = 2000;
const MAX_NOTE_LENGTH = 500;
const MAX_EVIDENCE_ITEMS = 3;
const MAX_EVIDENCE_URL_LENGTH = 2000;

/**
 * Distinct reporters with `pending` reports on the same target that
 * trigger automatic hiding of an activity. Three independent voices
 * is the classic low-false-positive bar for UGC triage; admins can
 * still restore via the normal status endpoints.
 */
export const AUTO_HIDE_DISTINCT_REPORTERS = 3;

export function isReportTargetType(value: unknown): value is ReportTargetType {
  return value === 'user' || value === 'activity';
}

export async function submitReport(input: SubmitReportInput): Promise<SubmitReportResult> {
  const reporterId = input.reporterId.trim();
  const targetId = input.targetId.trim();
  const reason = input.reason.trim();
  const details = input.details?.trim() || undefined;

  if (!reporterId) throw new Error('reporterId is required');
  if (!targetId) throw new Error('targetId is required');
  if (!isReportTargetType(input.targetType)) throw new Error('targetType must be user or activity');
  if (!reason) throw new Error('reason is required');

  if (reason.length > MAX_REASON_LENGTH) {
    throw new Error(`reason must be at most ${MAX_REASON_LENGTH} characters`);
  }

  if (details !== undefined && details.length > MAX_DETAILS_LENGTH) {
    throw new Error(`details must be at most ${MAX_DETAILS_LENGTH} characters`);
  }

  const evidenceUrls = (input.evidenceUrls ?? [])
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (evidenceUrls.length > MAX_EVIDENCE_ITEMS) {
    throw new Error(`evidenceUrls must be at most ${MAX_EVIDENCE_ITEMS} items`);
  }
  for (const url of evidenceUrls) {
    if (url.length > MAX_EVIDENCE_URL_LENGTH) {
      throw new Error(`evidence URL must be at most ${MAX_EVIDENCE_URL_LENGTH} characters`);
    }
  }

  if (reporterId === targetId) {
    throw new Error('cannot report yourself');
  }

  const targetPath =
    input.targetType === 'user' ? userDocPath(targetId) : activityDocPath(targetId);
  const targetSnap = await firestore.doc(targetPath).get();

  if (!targetSnap.exists) {
    throw new Error('Target not found');
  }

  const record: ReportRecord = {
    reporterId,
    targetId,
    targetType: input.targetType,
    reason,
    status: 'pending',
    createdAt: Timestamp.now(),
  };

  if (details !== undefined) {
    record.details = details;
  }
  if (evidenceUrls.length > 0) {
    record.evidenceUrls = evidenceUrls;
  }

  const ref = await firestore.collection('reports').add(record);

  // Auto-hide: N distinct reporters with pending reports on the
  // same target hides an activity immediately (best-effort — a
  // failure here must not fail the report itself).
  let autoHidden = false;
  try {
    autoHidden = await maybeAutoHide(targetId, input.targetType);
    if (autoHidden) {
      await firestore.collection('reports').doc(ref.id).update({ autoHidden: true });
    }
  } catch {
    autoHidden = false;
  }

  return { reportId: ref.id, autoHidden };
}

/**
 * Counts distinct reporters with `pending` reports against
 * [targetId]; when the count reaches the threshold and the target
 * is an activity, flips it to `removed` so it disappears from
 * Discover/feeds pending human review. Returns true when the flip
 * happened. Never throws — callers treat this as best-effort.
 */
async function maybeAutoHide(targetId: string, targetType: ReportTargetType): Promise<boolean> {
  if (targetType !== 'activity') return false;
  // Single-field query only — a second `where('status', ...)`
  // would need a composite index (repo policy: zero index ops),
  // so the pending filter runs in memory. Report rows per target
  // are few, so this stays cheap.
  const snap = await firestore.collection('reports').where('targetId', '==', targetId).get();
  const distinct = new Set<string>();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.status !== 'pending') continue;
    const reporterId = data.reporterId;
    if (typeof reporterId === 'string' && reporterId) {
      distinct.add(reporterId);
    }
  }
  if (distinct.size < AUTO_HIDE_DISTINCT_REPORTERS) return false;

  const activityRef = firestore.doc(activityDocPath(targetId));
  const activitySnap = await activityRef.get();
  if (!activitySnap.exists) return false;
  if (activitySnap.data()?.status === 'removed') return true;
  await activityRef.update({
    status: 'removed',
    updatedAt: Timestamp.now(),
  });
  return true;
}

/** Maps a free-text mobile reason onto an admin-board category. */
export function reportCategoryForReason(reason: string): ReportCategory {
  const r = reason.toLowerCase();
  if (r.includes('harass') || r.includes('bully') || r.includes('threat')) {
    return 'Harassment';
  }
  if (r.includes('spam') || r.includes('fake') || r.includes('scam')) {
    return 'Spam';
  }
  if (
    r.includes('impersonat') ||
    r.includes('fraud') ||
    r.includes('phish') ||
    r.includes('steal')
  ) {
    return 'Fraud';
  }
  if (
    r.includes('inappropriate') ||
    r.includes('explicit') ||
    r.includes('nude') ||
    r.includes('hate')
  ) {
    return 'Inappropriate Content';
  }
  if (
    r.includes('mislead') ||
    r.includes('misinform') ||
    r.includes('no-show') ||
    r.includes('noshow') ||
    r.includes('policy') ||
    r.includes('breach') ||
    r.includes('cheat')
  ) {
    return 'Policy Breach';
  }
  return 'Other';
}

export type ListReportsInput = {
  status?: ReportStatus;
  limit?: number;
};

/**
 * Triage-board listing (admin-only at the route layer). Newest
 * first, enriched with reporter/target display names so the UI
 * never has to join. Enrichment is best-effort — missing docs
 * fall back to raw ids.
 */
export async function listReports(input: ListReportsInput = {}): Promise<AdminReportView[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  let query: FirebaseFirestore.Query = firestore.collection('reports');
  if (input.status !== undefined) {
    if (input.status !== 'pending' && input.status !== 'resolved' && input.status !== 'dismissed') {
      throw new Error('status must be pending, resolved, or dismissed');
    }
    query = query.where('status', '==', input.status);
  }
  const snap = await query.limit(limit).get();
  const views: AdminReportView[] = [];
  for (const doc of snap.docs) {
    views.push(await toAdminView(doc.id, doc.data()));
  }
  // Newest first — single-field orderBy would need no composite
  // index, but createdAt is a Timestamp whose sort key differs per
  // row shape in tests/mocks; in-memory sort keeps this robust.
  views.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return views;
}

async function toAdminView(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Promise<AdminReportView> {
  const reason = typeof data.reason === 'string' ? data.reason : '';
  const targetType: ReportTargetType = data.targetType === 'user' ? 'user' : 'activity';
  const targetId = typeof data.targetId === 'string' ? data.targetId : '';
  const reporterId = typeof data.reporterId === 'string' ? data.reporterId : '';

  let reporter = reporterId || 'Unknown';
  try {
    const profile = reporterId ? await getPublicUserProfile(reporterId) : null;
    if (profile?.displayName) reporter = profile.displayName;
  } catch {
    // Fall through to the raw id.
  }

  let target = targetId || 'Unknown';
  let activityTitle = '';
  let sport = '';
  try {
    if (targetType === 'activity' && targetId) {
      const snap = await firestore.doc(activityDocPath(targetId)).get();
      const t = snap.exists ? snap.data() : undefined;
      const title = t?.title;
      if (typeof title === 'string' && title) {
        target = title;
        activityTitle = title;
      }
      if (typeof t?.sportType === 'string') sport = t.sportType;
    } else if (targetType === 'user' && targetId) {
      const profile = await getPublicUserProfile(targetId);
      if (profile?.displayName) target = profile.displayName;
    }
  } catch {
    // Fall through to the raw id.
  }

  const createdAt = toIso(data.createdAt) ?? new Date(0).toISOString();
  const resolvedAt = toIso(data.resolvedAt);
  const view: AdminReportView = {
    id,
    reporter,
    reporterAvatarSeed: reporterId,
    target,
    targetType,
    reason,
    category: reportCategoryForReason(reason),
    activityTitle,
    sport,
    status: statusLabel(data.status),
    createdAt,
  };
  if (typeof data.adminNote === 'string' && data.adminNote) {
    view.adminNote = data.adminNote;
  }
  if (resolvedAt) view.resolvedAt = resolvedAt;
  return view;
}

function statusLabel(status: unknown): 'Pending' | 'Resolved' | 'Dismissed' {
  if (status === 'resolved') return 'Resolved';
  if (status === 'dismissed') return 'Dismissed';
  return 'Pending';
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

export type TriageReportInput = {
  reportId: string;
  adminUid: string;
  note?: string;
};

/**
 * Marks a pending report `resolved` with the admin's note. Throws
 * `Report not found` / `Report is no longer pending` for bad or
 * already-triaged ids — the controller maps these to 404/409.
 */
export async function resolveReport(input: TriageReportInput): Promise<void> {
  await triageReport(input, 'resolved');
}

/** Same as [resolveReport] but marks the report `dismissed`. */
export async function dismissReport(input: TriageReportInput): Promise<void> {
  await triageReport(input, 'dismissed');
}

async function triageReport(
  input: TriageReportInput,
  status: 'resolved' | 'dismissed',
): Promise<void> {
  const reportId = input.reportId.trim();
  const adminUid = input.adminUid.trim();
  const note = input.note?.trim() || undefined;

  if (!reportId) throw new Error('reportId is required');
  if (!adminUid) throw new Error('adminUid is required');
  if (note !== undefined && note.length > MAX_NOTE_LENGTH) {
    throw new Error(`note must be at most ${MAX_NOTE_LENGTH} characters`);
  }

  const ref = firestore.collection('reports').doc(reportId);
  let before: FirebaseFirestore.DocumentData | undefined;
  await firestore.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new Error('Report not found');
    before = snap.data();
    if (before?.status !== 'pending') {
      throw new Error('Report is no longer pending');
    }
    transaction.update(ref, {
      status,
      ...(note !== undefined ? { adminNote: note } : {}),
      resolvedAt: Timestamp.now(),
      resolvedBy: adminUid,
    });
  });
  await logAdminAction({
    category: 'Reports',
    action: status === 'resolved' ? 'report.resolve' : 'report.dismiss',
    adminUid,
    // adminEmail not threaded through this call site for v1 — see
    // appeals.service.ts's decideAppeal for the same trade-off.
    description: `Marked report as ${status}`,
    targetId: reportId,
    targetLabel: typeof before?.reason === 'string' ? before.reason : reportId,
    before: { status: 'pending' },
    after: { status, adminNote: note ?? null },
  });
}
