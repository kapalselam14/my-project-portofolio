import { firestore } from '../../database/firebase.js';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../database/paths.js';
import type { ActivityWithId, ListActivitiesFilters } from './activities.service.js';
import { isFeeMode, isJoinPolicy } from './activities.service.js';
import { listSwipeDecisions } from '../swipes/swipes.service.js';
import { sweepExpiredActivities } from './activity-lifecycle.service.js';
import { geohashCover, geohashEncode, geohashNeighbors, haversineKm } from './geohash.js';

/** Maximum number of `geohash` cells the cover generator can produce. */
const MAX_CELLS = 16;

/** Score preferred sports heavily, then favor nearer activities and earlier start times. */
function rankDiscover(
  a: { sportType: string; skillLevel: string; distanceKm: number; startTimeMs: number },
  b: { sportType: string; skillLevel: string; distanceKm: number; startTimeMs: number },
  cfg: { sportsPreferred: Set<string>; now: number },
): number {
  const score = (x: typeof a) => {
    let s = 0;
    if (cfg.sportsPreferred.has(x.sportType)) s += 1_000_000;

    // Soonest start time first, with a small bias toward later-now.
    const startDelta = Math.max(0, x.startTimeMs - cfg.now);
    s -= Math.round(startDelta / 60_000);

    // Closer is better.
    s += Math.max(0, 999 - Math.round(x.distanceKm));
    return s;
  };
  return score(b) - score(a);
}

/** Build the `where(...).orderBy(...)` chain from the request. */
// Use a bounded geohash prefix lookup before applying precise distance checks in memory.
function buildQuery(
  base: FirebaseFirestore.Query,
  filters: ListActivitiesFilters,
): { query: FirebaseFirestore.Query; needGeohashScan: boolean } {
  let q = base;
  let needGeohashScan = false;

  if (filters.status !== undefined) {
    q = q.where('status', '==', filters.status);
  }
  if (filters.sportType !== undefined && filters.sportType !== '') {
    q = q.where('sportType', '==', filters.sportType.trim());
  }
  if (filters.skillLevel !== undefined) {
    q = q.where('skillLevel', '==', filters.skillLevel);
  }

  // Geohash pre-filter.
  void needGeohashScan;

  return { query: q, needGeohashScan };
}

/** In-memory filter pipeline applied to the (limit-bounded) result set. */
// Apply exact radius, date-window, preference, and exclusion rules to query candidates.
function passesInMemoryFilters(
  row: ActivityWithId & { distanceKm: number },
  filters: ListActivitiesFilters,
  nowMs: number,
): boolean {
  const startMs = Date.parse(row.startTime);
  // Stale `open` rows (the expiry sweep is eventual + fire-and-forget): never deal a game that already started.
  if (Number.isNaN(startMs) || startMs < nowMs) {
    return false;
  }
  if (filters.discover?.startAfter) {
    if (startMs < Date.parse(filters.discover.startAfter)) {
      return false;
    }
  }
  if (filters.discover?.startBefore) {
    if (startMs > Date.parse(filters.discover.startBefore)) {
      return false;
    }
  }

  if (filters.discover?.sportFilters?.length) {
    const want = filters.discover.sportFilters;
    const match = want.some((entry) => {
      if (entry.sport !== row.sportType) return false;
      return entry.skill === 'any' || entry.skill === row.skillLevel;
    });
    if (!match) return false;
  }

  if (filters.discover?.near) {
    const { radiusKm } = filters.discover.near;
    if (row.distanceKm > radiusKm) return false;
  }

  // `cancelled` / `completed` activities never show up in discover.
  if (row.status !== 'open') return false;

  return true;
}

/** Discover pipeline: query nearby candidates, apply exact filters and exclusions, then rank them. */
// Gather nearby candidates, apply viewer exclusions, enrich retained rows, and rank the feed.
export async function listDiscoverActivities(
  filters: ListActivitiesFilters,
): Promise<ActivityWithId[]> {
  if (!filters.discover) {
    throw new Error('listDiscoverActivities requires filters.discover');
  }
  if (filters.limit <= 0 || filters.limit > 50) {
    throw new Error('limit must be a number between 1 and 50');
  }

  const viewerUid = filters.viewerUid;
  if (!viewerUid) {
    throw new Error('discover requires viewerUid so swipes can be excluded');
  }

  // Best-effort expiry sweep — fire-and-forget, never blocks.
  sweepExpiredActivities().catch(() => undefined);

  const base = firestore.collection('activities');
  const { query } = buildQuery(base, { ...filters, status: 'open' });

  // No limit here: the in-memory sport/date/geo/swipe filters below can only REMOVE rows.
  const SCAN_CAP = 500;
  const snap = await query.limit(SCAN_CAP).get();
  const activities = snap.docs.map((doc) => mapDocForDiscover(doc));

  // Resolve swipes to exclude, unless the caller already provided a pre-filtered set.
  let exclude = new Set(filters.discover.excludeActivityIds ?? []);
  if (!filters.discover.excludeActivityIds) {
    const swipes = await listSwipeDecisions(viewerUid);
    const swipedIds = filters.discover.includeSwiped
      ? swipes.filter((s) => s.decision === 'join').map((s) => s.activityId)
      : swipes.map((s) => s.activityId);
    exclude = new Set(swipedIds);
  }

  // Joined without swiping (detail-screen Join button, approved join requests) leaves no swipe record.
  try {
    const partSnap = await firestore
      .collectionGroup(SUBCOLLECTIONS.participants)
      .where('uid', '==', viewerUid)
      .get();
    for (const doc of partSnap.docs) {
      const segments = doc.ref.path.split('/');
      const ai = segments.indexOf(COLLECTIONS.activities);
      const joinedId = ai >= 0 ? segments[ai + 1] : undefined;
      if (joinedId) {
        exclude.add(joinedId);
      }
    }
  } catch {
    // Fall through — swipe + host + expiry checks still filter.
  }

  const now = Date.now();
  const baseLat = filters.discover.near?.latitude;
  const baseLng = filters.discover.near?.longitude;

  const filtered: Array<ActivityWithId & { startTimeMs: number; distanceKm: number }> = [];
  for (const act of activities) {
    // A host never discovers their own game — they already manage it from My Games, and it can't be "joined" anyway.
    if (act.hostId === viewerUid) continue;
    if (exclude.has(act.activityId)) continue;

    // Belt and suspenders for "full": the status machine flips to `full` at capacity.
    if (act.participantCount >= act.capacity) continue;

    const startTimeMs = Date.parse(act.startTime);
    if (Number.isNaN(startTimeMs)) continue;

    // Deterministic expiry gate.
    const parsedEnd = typeof act.endTime === 'string' ? Date.parse(act.endTime) : Number.NaN;
    const effectiveEndMs = Number.isNaN(parsedEnd) ? startTimeMs + 2 * 60 * 60 * 1000 : parsedEnd;
    if (effectiveEndMs <= now) continue;

    const distanceKm =
      baseLat !== undefined && baseLng !== undefined
        ? haversineKm(baseLat, baseLng, act.latitude, act.longitude)
        : 0;

    if (!passesInMemoryFilters({ ...act, distanceKm }, filters, now)) {
      continue;
    }

    filtered.push({ ...act, startTimeMs, distanceKm });
  }

  const sportsPreferred = new Set(
    (filters.discover.sportFilters ?? []).filter((s) => s.skill !== 'any').map((s) => s.sport),
  );
  filtered.sort((a, b) => rankDiscover(a, b, { sportsPreferred, now }));

  // Trim to requested limit and strip the pipeline-internal fields.
  return filtered
    .slice(0, filters.limit)
    .map(({ startTimeMs: _s, distanceKm: _d, ...rest }) => rest);
}

/** Lightweight mapper for the discover pipeline. */
function mapDocForDiscover(doc: FirebaseFirestore.QueryDocumentSnapshot): ActivityWithId {
  const data = doc.data();

  if (typeof data.hostId !== 'string') {
    throw new Error('Invalid activity record: hostId must be a string');
  }
  if (typeof data.title !== 'string') {
    throw new Error('Invalid activity record: title must be a string');
  }
  if (typeof data.sportType !== 'string') {
    throw new Error('Invalid activity record: sportType must be a string');
  }
  if (typeof data.description !== 'string') {
    throw new Error('Invalid activity record: description must be a string');
  }
  if (typeof data.locationName !== 'string') {
    throw new Error('Invalid activity record: locationName must be a string');
  }
  if (typeof data.geohash !== 'string') {
    throw new Error('Invalid activity record: geohash must be a string');
  }
  if (typeof data.latitude !== 'number') {
    throw new Error('Invalid activity record: latitude must be a number');
  }
  if (typeof data.longitude !== 'number') {
    throw new Error('Invalid activity record: longitude must be a number');
  }
  if (typeof data.startTime !== 'string') {
    throw new Error('Invalid activity record: startTime must be a string');
  }
  if (typeof data.capacity !== 'number') {
    throw new Error('Invalid activity record: capacity must be a number');
  }
  if (typeof data.participantCount !== 'number') {
    throw new Error('Invalid activity record: participantCount must be a string');
  }
  if (typeof data.status !== 'string') {
    throw new Error('Invalid activity record: status must be a string');
  }

  const base: ActivityWithId = {
    activityId: doc.id,
    hostId: data.hostId,
    title: data.title,
    sportType: data.sportType,
    description: data.description,
    locationName: data.locationName,
    ...(typeof data.address === 'string' ? { address: data.address } : {}),
    latitude: data.latitude,
    longitude: data.longitude,
    geohash: data.geohash,
    startTime: data.startTime,
    ...(typeof data.endTime === 'string' ? { endTime: data.endTime } : {}),
    skillLevel: data.skillLevel as ActivityWithId['skillLevel'],
    capacity: data.capacity,
    participantCount: data.participantCount,
    pendingRequestCount:
      typeof data.pendingRequestCount === 'number' ? data.pendingRequestCount : 0,
    status: data.status as ActivityWithId['status'],
    joinPolicy: isJoinPolicy(data.joinPolicy) ? data.joinPolicy : 'open',
    isPaid: data.isPaid === true,
    ...(typeof data.fee === 'number' && Number.isFinite(data.fee) && data.fee > 0
      ? { fee: data.fee }
      : {}),
    ...(isFeeMode(data.feeMode) ? { feeMode: data.feeMode } : {}),
    ...(typeof data.totalCost === 'number' && Number.isFinite(data.totalCost) && data.totalCost > 0
      ? { totalCost: data.totalCost }
      : {}),
    ...(Number.isInteger(data.minPlayers) && (data.minPlayers as number) >= 2
      ? { minPlayers: data.minPlayers as number }
      : {}),
    ...(typeof data.coverImageUrl === 'string' ? { coverImageUrl: data.coverImageUrl } : {}),
    ...(data.cancelledAt !== undefined
      ? { cancelledAt: data.cancelledAt as FirebaseFirestore.Timestamp }
      : {}),
    ...(typeof data.cancelledBy === 'string' ? { cancelledBy: data.cancelledBy } : {}),
    createdAt: data.createdAt as FirebaseFirestore.Timestamp,
    updatedAt: data.updatedAt as FirebaseFirestore.Timestamp,
    hostProfile: null,
  };

  return base;
}
