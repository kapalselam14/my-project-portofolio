import { firestore } from '../../database/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { activityDocPath } from '../../database/paths.js';
import { sweepExpiredActivities } from './activity-lifecycle.service.js';
import type {
  ActivityBaseWithId,
  ActivityRecord,
  ActivityStatus,
  ActivityWithId,
  CreateActivityInput,
  ActivitySkillLevel,
  ListActivitiesFilters,
  PublicActivityTeaser,
  SportSkillFilter,
} from './activities.service.js';
import { enrichActivityWithHostProfile } from './activity-enrichment.js';
import {
  isFeeMode,
  isJoinPolicy,
  normalizeWeatherSnapshot,
  resolvePaidFee,
  resolveSplitCost,
} from './activity-pricing.js';

// Activity reads: create, fetch, lists, public teasers.

// Normalize and validate caller input before writing the canonical activity document.
export async function createActivity(input: CreateActivityInput): Promise<{ activityId: string }> {
  const now = Timestamp.now();

  const hostId = input.hostId.trim();
  const title = input.title.trim();
  const sportType = input.sportType.trim();
  const description = input.description?.trim() ?? '';
  const locationName = input.locationName.trim();
  const address = input.address?.trim();
  const latitude = input.latitude;
  const longitude = input.longitude;
  const geohash = input.geohash.trim();
  const startTime = input.startTime.trim();
  const endTime = input.endTime?.trim();
  const skillLevel = input.skillLevel;
  const capacity = input.capacity;
  const coverImageUrl = input.coverImageUrl?.trim();
  const joinPolicy = input.joinPolicy ?? 'open';

  if (!hostId) throw new Error('hostId is required');
  if (!title) throw new Error('title is required');
  if (!sportType) throw new Error('sportType is required');
  if (!locationName) throw new Error('locationName is required');
  if (!geohash) throw new Error('geohash is required');
  if (!startTime) throw new Error('startTime is required');

  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    throw new Error('latitude must be a number between -90 and 90');
  }

  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    throw new Error('longitude must be a number between -180 and 180');
  }

  if (!['beginner', 'intermediate', 'advanced', 'any'].includes(skillLevel)) {
    throw new Error('skillLevel is invalid');
  }

  if (!isJoinPolicy(joinPolicy)) {
    throw new Error('joinPolicy must be open or approval');
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error('capacity must be a positive integer');
  }

  const { isPaid, fee } = resolvePaidFee(input.isPaid, input.fee);
  const split = resolveSplitCost(input.feeMode, input.totalCost, input.minPlayers, capacity);
  // Split mode without an explicit per-person fee: derive the worst case so old clients.
  const effectiveFee =
    fee ??
    (isPaid && split.feeMode === 'split' && split.totalCost !== undefined
      ? Math.round((split.totalCost / (split.minPlayers ?? capacity)) * 100) / 100
      : undefined);

  // Weather snapshot (best-effort, all optional). Validated lightly — a bad snapshot must never fail activity creation.
  const weather = normalizeWeatherSnapshot({
    weatherTemp: input.weatherTemp,
    weatherCode: input.weatherCode,
    weatherDesc: input.weatherDesc,
    weatherRain: input.weatherRain,
  });

  const activitiesRef = firestore.collection('activities');
  const newActivityRef = activitiesRef.doc();

  await newActivityRef.set({
    hostId,
    title,
    sportType,
    description,
    locationName,
    ...(address ? { address } : {}),
    latitude,
    longitude,
    geohash,
    startTime,
    ...(endTime ? { endTime } : {}),
    skillLevel,
    capacity,
    participantCount: 0,
    pendingRequestCount: 0,
    status: 'open',
    ...(coverImageUrl ? { coverImageUrl } : {}),
    joinPolicy,
    isPaid,
    ...(effectiveFee !== undefined ? { fee: effectiveFee } : {}),
    feeMode: split.feeMode,
    ...(split.totalCost !== undefined ? { totalCost: split.totalCost } : {}),
    ...(split.minPlayers !== undefined ? { minPlayers: split.minPlayers } : {}),
    ...weather,
    createdAt: now,
    updatedAt: now,
  });

  return {
    activityId: newActivityRef.id,
  };
}

export async function getActivityById(activityId: string): Promise<ActivityWithId | null> {
  const normalizedActivityId = activityId.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  const activityDoc = await firestore.doc(activityDocPath(normalizedActivityId)).get();

  if (!activityDoc.exists) {
    return null;
  }

  return enrichActivityWithHostProfile(mapActivityDoc(activityDoc));
}

export async function listActivities(filters: ListActivitiesFilters): Promise<ActivityWithId[]> {
  // Best-effort expiry sweep — fire-and-forget so a slow/stuck sweep never adds latency to the read path.
  sweepExpiredActivities().catch(() => undefined);
  let query: FirebaseFirestore.Query = firestore.collection('activities');

  if (filters.status !== undefined) {
    query = query.where('status', '==', filters.status);
  }

  if (filters.sportType !== undefined) {
    query = query.where('sportType', '==', filters.sportType.trim());
  }

  if (filters.skillLevel !== undefined) {
    query = query.where('skillLevel', '==', filters.skillLevel);
  }

  // NOTE: no server-side orderBy here on purpose.
  const snap = await query.get();

  // Deterministic start gate for joinable listings.
  const nowMs = Date.now();
  const gateStart = (filters.status ?? 'open') === 'open';

  const activities = snap.docs
    .map(mapActivityDoc)
    .filter((a) => {
      if (!gateStart) return true;
      const startMs = Date.parse(a.startTime);
      return !Number.isNaN(startMs) && startMs >= nowMs;
    })
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, filters.limit);

  return Promise.all(activities.map(enrichActivityWithHostProfile));
}

/** Hosted and joined lists use separate lookups, then share filtering and pagination rules. */
export async function listMyActivities(
  viewerUid: string,
  kind: 'hosted' | 'joined',
  limit: number,
  offset = 0,
): Promise<ActivityWithId[]> {
  const uid = viewerUid.trim();
  if (!uid) throw new Error('uid is required');
  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('offset must be a non-negative integer');
  }

  if (kind === 'hosted') {
    const snap = await firestore.collection('activities').where('hostId', '==', uid).get();
    const activities = snap.docs
      .map(mapActivityDoc)
      .filter((a) => !isTerminalStatus(a.status))
      .sort(compareStartTimeAsc)
      .slice(offset, offset + limit);
    return Promise.all(activities.map(enrichActivityWithHostProfile));
  }

  const partSnap = await firestore.collectionGroup('participants').where('uid', '==', uid).get();
  const activityIds = [
    ...new Set(
      partSnap.docs
        .map((d) => d.ref.parent.parent?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];
  if (activityIds.length === 0) return [];
  const snaps = await Promise.all(
    activityIds.map((id) => firestore.doc(activityDocPath(id)).get()),
  );
  const activities = snaps
    .filter((s) => s.exists)
    .map(mapActivityDoc)
    .filter((a) => a.hostId !== uid)
    .filter((a) => !isTerminalStatus(a.status))
    .sort(compareStartTimeAsc)
    .slice(offset, offset + limit);
  return Promise.all(activities.map(enrichActivityWithHostProfile));
}

/** Merge hosted and joined records by activity id so a user sees each completed game once. */
export async function listPastActivitiesForUser(
  viewerUid: string,
  limit: number,
  offset = 0,
): Promise<ActivityWithId[]> {
  const uid = viewerUid.trim();
  if (!uid) throw new Error('uid is required');
  if (!Number.isInteger(limit) || limit <= 0 || limit > 50) {
    throw new Error('limit must be an integer between 1 and 50');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('offset must be a non-negative integer');
  }

  const [hostedSnap, partSnap] = await Promise.all([
    firestore.collection('activities').where('hostId', '==', uid).get(),
    firestore.collectionGroup('participants').where('uid', '==', uid).get(),
  ]);
  const activityIds = [
    ...new Set(
      partSnap.docs
        .map((d) => d.ref.parent.parent?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];
  const joinedSnaps = await Promise.all(
    activityIds.map((id) => firestore.doc(activityDocPath(id)).get()),
  );
  const seen = new Map<string, ActivityBaseWithId>();
  for (const doc of hostedSnap.docs) {
    try {
      const a = mapActivityDoc(doc);
      if (!seen.has(a.activityId)) seen.set(a.activityId, a);
    } catch {
      // Skip malformed rows (same policy as the list reads).
    }
  }
  for (const snap of joinedSnaps) {
    if (!snap.exists) continue;
    try {
      const a = mapActivityDoc(snap);
      if (!seen.has(a.activityId)) seen.set(a.activityId, a);
    } catch {
      // Skip malformed rows.
    }
  }
  const past = [...seen.values()]
    .filter((a) => a.status === 'completed')
    .sort((a, b) => {
      const aMs = Date.parse(a.startTime);
      const bMs = Date.parse(b.startTime);
      if (Number.isNaN(aMs)) return Number.isNaN(bMs) ? 0 : 1;
      if (Number.isNaN(bMs)) return -1;
      return bMs - aMs;
    })
    .slice(offset, offset + limit);
  return Promise.all(past.map(enrichActivityWithHostProfile));
}

/** True for lifecycles that must not appear in Upcoming/Hosting. */
function isTerminalStatus(status: ActivityStatus): boolean {
  return status === 'cancelled' || status === 'completed' || status === 'removed';
}

/** Soonest event first (rows without a parseable start go last). */
function compareStartTimeAsc(a: { startTime: string }, b: { startTime: string }): number {
  const aMs = Date.parse(a.startTime);
  const bMs = Date.parse(b.startTime);
  if (Number.isNaN(aMs)) return Number.isNaN(bMs) ? 0 : 1;
  if (Number.isNaN(bMs)) return -1;
  return aMs - bMs;
}

// Return a bounded public projection without host enrichment or private activity fields.
export async function listPublicActivityTeasers(limit = 10): Promise<PublicActivityTeaser[]> {
  if (!Number.isInteger(limit) || limit <= 0 || limit > 20) {
    throw new Error('limit must be an integer between 1 and 20');
  }

  // NOTE: same as listActivities — in-memory sort avoids the composite-index requirement for `where(status) +.
  const snap = await firestore.collection('activities').where('status', '==', 'open').get();

  const activities = snap.docs
    .map(mapActivityDoc)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, limit);

  return activities.map((activity) => ({
    activityId: activity.activityId,
    title: activity.title,
    sportType: activity.sportType,
    locationName: activity.locationName,
    latitude: activity.latitude,
    longitude: activity.longitude,
    startTime: activity.startTime,
    skillLevel: activity.skillLevel,
    availableSpots: Math.max(activity.capacity - activity.participantCount, 0),
    ...(activity.coverImageUrl !== undefined ? { coverImageUrl: activity.coverImageUrl } : {}),
  }));
}

// Validate persisted data at the boundary and normalize optional legacy fields for callers.
function mapActivityDoc(activityDoc: FirebaseFirestore.DocumentSnapshot): ActivityBaseWithId {
  const data = activityDoc.data();

  if (!data) {
    throw new Error('Invalid activity record: data is missing');
  }

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
    throw new Error('Invalid activity record: participantCount must be a number');
  }
  if (typeof data.status !== 'string') {
    throw new Error('Invalid activity record: status must be a string');
  }
  if (!data.createdAt || typeof data.createdAt !== 'object' || !('toDate' in data.createdAt)) {
    throw new Error('Invalid activity record: createdAt must be a Firestore Timestamp');
  }
  if (!data.updatedAt || typeof data.updatedAt !== 'object' || !('toDate' in data.updatedAt)) {
    throw new Error('Invalid activity record: updatedAt must be a Firestore Timestamp');
  }
  if (
    data.cancelledAt !== undefined &&
    (!data.cancelledAt || typeof data.cancelledAt !== 'object' || !('toDate' in data.cancelledAt))
  ) {
    throw new Error('Invalid activity record: cancelledAt must be a Firestore Timestamp');
  }
  if (data.cancelledBy !== undefined && typeof data.cancelledBy !== 'string') {
    throw new Error('Invalid activity record: cancelledBy must be a string');
  }

  return {
    activityId: activityDoc.id,
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
    skillLevel: data.skillLevel as ActivitySkillLevel,
    capacity: data.capacity,
    participantCount: data.participantCount,
    pendingRequestCount:
      typeof data.pendingRequestCount === 'number' ? data.pendingRequestCount : 0,
    status: data.status as ActivityStatus,
    ...(typeof data.coverImagePath === 'string' ? { coverImagePath: data.coverImagePath } : {}),
    ...(typeof data.coverImageUrl === 'string' ? { coverImageUrl: data.coverImageUrl } : {}),
    joinPolicy: isJoinPolicy(data.joinPolicy) ? data.joinPolicy : 'open',
    isPaid: data.isPaid === true,
    ...(typeof data.fee === 'number' && Number.isFinite(data.fee) && data.fee > 0
      ? { fee: data.fee }
      : {}),
    feeMode: isFeeMode(data.feeMode) ? data.feeMode : 'fixed',
    ...(typeof data.totalCost === 'number' && Number.isFinite(data.totalCost) && data.totalCost > 0
      ? { totalCost: data.totalCost }
      : {}),
    ...(Number.isInteger(data.minPlayers) && (data.minPlayers as number) >= 2
      ? { minPlayers: data.minPlayers as number }
      : {}),
    ...(data.cancelledAt !== undefined
      ? { cancelledAt: data.cancelledAt as FirebaseFirestore.Timestamp }
      : {}),
    ...(typeof data.cancelledBy === 'string' ? { cancelledBy: data.cancelledBy } : {}),
    createdAt: data.createdAt as FirebaseFirestore.Timestamp,
    updatedAt: data.updatedAt as FirebaseFirestore.Timestamp,
  };
}
