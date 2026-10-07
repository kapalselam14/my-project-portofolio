import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import { TtlCache } from '../../utils/ttl-cache.js';
import { logAdminAction } from './audit.service.js';

/** Admin-managed master sports list — the future source of truth for the mobile pickers. */
export type SportView = {
  id: string;
  name: string;
  emoji: string;
  enabled: boolean;
  showInFilter: boolean;
  showInOnboarding: boolean;
  canHost: boolean;
  sortOrder: number;
  activityCount: number;
};

export type UpdateSportInput = {
  enabled?: unknown;
  showInFilter?: unknown;
  showInOnboarding?: unknown;
  canHost?: unknown;
};

const FLAG_FIELDS = ['enabled', 'showInFilter', 'showInOnboarding', 'canHost'] as const;

/** 5-minute cache for the admin-curated sports list (see `listSports`). */
const sportsCache = new TtlCache<SportView[]>(5 * 60 * 1000);

/** For tests: force the next `listSports()` to refetch. */
export function invalidateSportsCache(): void {
  // Mutations clear the short-lived read cache so callers see the newly published list.
  sportsCache.invalidate();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function listSports(): Promise<SportView[]> {
  // Return cached configuration when fresh; otherwise load Firestore or its built-in fallback.
  // Admin-curated config hit by every onboarding/filter/create surface: 1 collection read + N count queries per call.
  return sportsCache.getOrFill('all', fetchSports);
}

/** Static fallback when the `sports` collection is empty (fresh project, failed seed, or an offline emulator). */
const SPORTS_SEED: Array<Omit<SportView, 'activityCount'>> = [
  {
    id: 'football',
    name: 'Football',
    emoji: '⚽',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 1,
  },
  {
    id: 'basketball',
    name: 'Basketball',
    emoji: '🏀',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 2,
  },
  {
    id: 'tennis',
    name: 'Tennis',
    emoji: '🎾',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 3,
  },
  {
    id: 'badminton',
    name: 'Badminton',
    emoji: '🏸',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 4,
  },
  {
    id: 'running',
    name: 'Running',
    emoji: '🏃',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 5,
  },
  {
    id: 'cycling',
    name: 'Cycling',
    emoji: '🚴',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 6,
  },
  {
    id: 'swimming',
    name: 'Swimming',
    emoji: '🏊',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 7,
  },
  {
    id: 'volleyball',
    name: 'Volleyball',
    emoji: '🏐',
    enabled: true,
    showInFilter: true,
    showInOnboarding: true,
    canHost: true,
    sortOrder: 8,
  },
];

async function fetchSports(): Promise<SportView[]> {
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await firestore.collection('sports').get();
  } catch {
    return SPORTS_SEED.map((s) => ({ ...s, activityCount: 0 }));
  }
  // `snap.empty` is the Firestore-native check.
  if (snap.empty || snap.docs.length === 0) {
    return SPORTS_SEED.map((s) => ({ ...s, activityCount: 0 }));
  }
  const rows: SportView[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data?.name !== 'string') continue;
    let activityCount = 0;
    try {
      const countSnap = await firestore
        .collection('activities')
        .where('sportType', '==', data.name)
        .count()
        .get();
      activityCount = countSnap.data().count;
    } catch {
      activityCount = 0;
    }
    rows.push({
      id: doc.id,
      name: data.name,
      emoji: typeof data.emoji === 'string' ? data.emoji : '',
      enabled: data.enabled !== false,
      showInFilter: data.showInFilter !== false,
      showInOnboarding: data.showInOnboarding !== false,
      canHost: data.canHost !== false,
      sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 999,
      activityCount,
    });
  }
  rows.sort((a, b) => a.sortOrder - b.sortOrder);
  return rows;
}

export type BulkSportInput = {
  id?: unknown;
  name?: unknown;
  emoji?: unknown;
  enabled?: unknown;
  showInFilter?: unknown;
  showInOnboarding?: unknown;
  canHost?: unknown;
  sortOrder?: unknown;
};

function assertBulkSport(
  value: unknown,
  index: number,
): {
  id: string;
  record: Record<string, string | number | boolean>;
} {
  if (!isRecord(value)) {
    throw new Error(`sports[${index}] must be an object`);
  }
  const { id, name, emoji, enabled, showInFilter, showInOnboarding, canHost, sortOrder } =
    value as Record<string, unknown>;
  if (typeof id !== 'string' || !/^[a-z0-9]+$/.test(id)) {
    throw new Error(`sports[${index}].id must be a lowercase alphanumeric key`);
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`sports[${index}].name is required`);
  }
  for (const [field, flag] of [
    ['enabled', enabled],
    ['showInFilter', showInFilter],
    ['showInOnboarding', showInOnboarding],
    ['canHost', canHost],
  ] as const) {
    if (typeof flag !== 'boolean') {
      throw new Error(`sports[${index}].${field} must be a boolean`);
    }
  }
  if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) {
    throw new Error(`sports[${index}].sortOrder must be a number`);
  }
  return {
    id,
    record: {
      name: name.trim(),
      emoji: typeof emoji === 'string' ? emoji : '',
      enabled: enabled as boolean,
      showInFilter: showInFilter as boolean,
      showInOnboarding: showInOnboarding as boolean,
      canHost: canHost as boolean,
      sortOrder: sortOrder as number,
    },
  };
}

/** Validate and atomically publish the whole ordered sports list; `activityCount` is never accepted. */
export async function replaceSports(
  sports: unknown,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<SportView[]> {
  if (!Array.isArray(sports) || sports.length === 0) {
    throw new Error('sports must be a non-empty array');
  }
  if (sports.length > 100) {
    throw new Error('sports must contain at most 100 entries');
  }
  const parsed = sports.map((s, i) => assertBulkSport(s, i));
  const ids = new Set(parsed.map((p) => p.id));
  if (ids.size !== parsed.length) {
    throw new Error('sports ids must be unique');
  }
  const col = firestore.collection('sports');
  const existing = await col.get();
  const batch = firestore.batch();
  for (const doc of existing.docs) {
    if (!ids.has(doc.id)) batch.delete(doc.ref);
  }
  for (const { id, record } of parsed) {
    batch.set(col.doc(id), { ...record, updatedAt: Timestamp.now() }, { merge: true });
  }
  await batch.commit();
  // Invalidate BEFORE the trailing listSports().
  invalidateSportsCache();
  // One summary entry for the whole bulk replace, not one per sport.
  await logAdminAction({
    category: 'Sports',
    action: 'sport.replace',
    adminUid,
    adminEmail,
    description: `Published sports config (${parsed.length} sports)`,
    metadata: { count: String(parsed.length), ids: parsed.map((p) => p.id).join(',') },
  });
  return listSports();
}

// Apply a partial sport edit and invalidate cached list data after persistence succeeds.
export async function updateSport(
  id: string,
  input: UpdateSportInput,
  adminUid: string,
  adminEmail: string | null = null,
): Promise<SportView> {
  const normalizedId = id.trim();
  if (!normalizedId) throw new Error('sportId is required');
  if (!isRecord(input)) throw new Error('Invalid sport patch');
  const patch: Record<string, boolean> = {};
  for (const field of FLAG_FIELDS) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') {
      throw new Error(`${field} must be a boolean`);
    }
    patch[field] = value;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error('No updatable sport flags provided');
  }
  const ref = firestore.collection('sports').doc(normalizedId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Sport not found');
  const before = snap.data();
  await ref.update(patch);
  invalidateSportsCache();
  const rows = await listSports();
  const view = rows.find((r) => r.id === normalizedId);
  if (!view) throw new Error('Sport not found');
  await logAdminAction({
    category: 'Sports',
    action: 'sport.update',
    adminUid,
    adminEmail,
    description: `Updated ${view.name} flags`,
    targetId: normalizedId,
    targetLabel: view.name,
    before: FLAG_FIELDS.reduce<Record<string, unknown>>((acc, f) => {
      acc[f] = before?.[f] ?? null;
      return acc;
    }, {}),
    after: patch,
  });
  return view;
}
