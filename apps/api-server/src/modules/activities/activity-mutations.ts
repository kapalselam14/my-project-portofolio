import { firestore } from '../../database/firebase.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { activityDocPath } from '../../database/paths.js';
import { getParticipants } from './activity-participants.service.js';
import type {
  ActivityFeeMode,
  ActivityRecord,
  UpdateActivityCoverInput,
  UpdateActivityInput,
  UpdateActivityStatusInput,
} from './activities.service.js';
import {
  isFeeMode,
  isJoinPolicy,
  normalizeWeatherSnapshot,
  resolvePaidFee,
  resolveSplitCost,
} from './activity-pricing.js';
import { createNotification, renderTemplate } from '../notifications/notifications.service.js';

// Activity writes: cover, status, full updates (+ participant notices).

export async function updateActivityCover(input: UpdateActivityCoverInput): Promise<void> {
  // Check host ownership before replacing the activity's cover reference.
  const activityId = input.activityId.trim();
  const hostId = input.hostId.trim();
  const coverImagePath = input.coverImagePath.trim();
  const coverImageUrl = input.coverImageUrl.trim();
  const now = Timestamp.now();

  if (!activityId) {
    throw new Error('activityId is required');
  }

  if (!hostId) {
    throw new Error('hostId is required');
  }

  if (!coverImagePath) {
    throw new Error('coverImagePath is required');
  }

  if (!coverImageUrl) {
    throw new Error('coverImageUrl is required');
  }

  if (!coverImagePath.startsWith(`activities/${activityId}/cover/`)) {
    throw new Error('coverImagePath must belong to the activity');
  }

  const activityRef = firestore.doc(activityDocPath(activityId));

  await firestore.runTransaction(async (transaction) => {
    const activitySnap = await transaction.get(activityRef);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const data = activitySnap.data();

    if (data?.hostId !== hostId) {
      throw new Error('Only the activity host can update this activity');
    }

    transaction.update(activityRef, {
      coverImagePath,
      coverImageUrl,
      updatedAt: now,
    });
  });
}

export async function updateActivityStatus(input: UpdateActivityStatusInput): Promise<void> {
  // Keep lifecycle changes and related participant updates consistent in a transaction.
  const activityId = input.activityId.trim();
  const hostId = input.hostId.trim();
  const status = input.status;
  const now = Timestamp.now();

  if (!activityId) {
    throw new Error('activityId is required');
  }

  if (!hostId) {
    throw new Error('hostId is required');
  }

  if (
    status !== 'open' &&
    status !== 'cancelled' &&
    status !== 'completed' &&
    status !== 'removed'
  ) {
    throw new Error('status must be open, cancelled, completed, or removed');
  }

  const activityRef = firestore.doc(activityDocPath(activityId));

  await firestore.runTransaction(async (transaction) => {
    const activitySnap = await transaction.get(activityRef);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const data = activitySnap.data();

    if (data?.hostId !== hostId) {
      throw new Error('Only the activity host can update this activity');
    }

    transaction.update(activityRef, {
      status,
      updatedAt: now,
    });
  });
}

export async function updateActivity(input: UpdateActivityInput): Promise<void> {
  // Merge the partial edit with the stored record before validating cross-field constraints.
  const activityId = input.activityId.trim();
  const hostId = input.hostId.trim();
  const now = Timestamp.now();

  if (!activityId) {
    throw new Error('activityId is required');
  }

  if (!hostId) {
    throw new Error('hostId is required');
  }

  const updates: Partial<ActivityRecord> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.sportType !== undefined) updates.sportType = input.sportType.trim();
  if (input.description !== undefined) updates.description = input.description.trim();
  if (input.locationName !== undefined) updates.locationName = input.locationName.trim();
  if (input.address !== undefined) updates.address = input.address.trim();
  if (input.latitude !== undefined) {
    if (typeof input.latitude !== 'number' || input.latitude < -90 || input.latitude > 90) {
      throw new Error('latitude must be a number between -90 and 90');
    }

    updates.latitude = input.latitude;
  }
  if (input.longitude !== undefined) {
    if (typeof input.longitude !== 'number' || input.longitude < -180 || input.longitude > 180) {
      throw new Error('longitude must be a number between -180 and 180');
    }

    updates.longitude = input.longitude;
  }
  if (input.geohash !== undefined) updates.geohash = input.geohash.trim();
  if (input.startTime !== undefined) updates.startTime = input.startTime.trim();
  if (input.endTime !== undefined) updates.endTime = input.endTime.trim();
  if (input.coverImageUrl !== undefined) updates.coverImageUrl = input.coverImageUrl.trim();
  if (input.joinPolicy !== undefined) {
    if (!isJoinPolicy(input.joinPolicy)) {
      throw new Error('joinPolicy must be open or approval');
    }

    updates.joinPolicy = input.joinPolicy;
  }

  Object.assign(
    updates,
    normalizeWeatherSnapshot({
      weatherTemp: input.weatherTemp,
      weatherCode: input.weatherCode,
      weatherDesc: input.weatherDesc,
      weatherRain: input.weatherRain,
    }),
  );

  if (input.skillLevel !== undefined) {
    if (
      input.skillLevel !== 'beginner' &&
      input.skillLevel !== 'intermediate' &&
      input.skillLevel !== 'advanced' &&
      input.skillLevel !== 'any'
    ) {
      throw new Error('skillLevel must be beginner, intermediate, advanced, or any');
    }

    updates.skillLevel = input.skillLevel;
  }

  if (input.capacity !== undefined) {
    if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
      throw new Error('capacity must be a positive integer');
    }
    updates.capacity = input.capacity;
  }

  // Paid/free changes are resolved inside the transaction against the current doc: flipping to paid without a fee.
  const wantsPaidChange = input.isPaid !== undefined || input.fee !== undefined;
  if (input.isPaid !== undefined && typeof input.isPaid !== 'boolean') {
    throw new Error('isPaid must be a boolean');
  }
  if (
    input.fee !== undefined &&
    (typeof input.fee !== 'number' || !Number.isFinite(input.fee) || input.fee <= 0)
  ) {
    throw new Error('fee must be a positive number for paid activities');
  }
  if (input.feeMode !== undefined && !isFeeMode(input.feeMode)) {
    throw new Error('feeMode must be fixed or split');
  }
  if (
    input.totalCost !== undefined &&
    (typeof input.totalCost !== 'number' ||
      !Number.isFinite(input.totalCost) ||
      input.totalCost <= 0)
  ) {
    throw new Error('totalCost must be a positive number for split mode');
  }
  if (
    input.minPlayers !== undefined &&
    (!Number.isInteger(input.minPlayers) || input.minPlayers < 2)
  ) {
    throw new Error('minPlayers must be an integer >= 2');
  }
  const stringFields = [
    updates.title,
    updates.sportType,
    updates.description,
    updates.locationName,
    updates.geohash,
    updates.startTime,
  ];

  if (stringFields.some((value) => value !== undefined && !value)) {
    throw new Error('updated string fields cannot be blank');
  }

  const activityRef = firestore.doc(activityDocPath(activityId));

  // Participant-visible fields before the write — compared post-commit so members learn what changed.
  let before: Record<string, unknown> | null = null;

  await firestore.runTransaction(async (transaction) => {
    const activitySnap = await transaction.get(activityRef);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const data = activitySnap.data();

    if (data?.hostId !== hostId) {
      throw new Error('Only the activity host can update this activity');
    }

    before = {
      title: data?.title,
      startTime: data?.startTime,
      endTime: data?.endTime,
      locationName: data?.locationName,
      address: data?.address,
      latitude: data?.latitude,
      longitude: data?.longitude,
      geohash: data?.geohash,
      capacity: data?.capacity,
    };

    if (wantsPaidChange) {
      const currentPaid = data?.isPaid === true;
      const currentFee = typeof data?.fee === 'number' ? (data.fee as number) : undefined;
      const nextPaid = input.isPaid ?? currentPaid;
      const nextFee = input.fee ?? currentFee;
      const resolved = resolvePaidFee(nextPaid, nextFee);
      updates.isPaid = resolved.isPaid;
      if (resolved.fee !== undefined) {
        updates.fee = resolved.fee;
      } else {
        // Clear a stale fee when the activity goes free.
        (updates as Record<string, unknown>).fee = FieldValue.delete();
      }
      // Split-cost fields ride along with paid changes; going free clears them too so stale split data never lingers.
      const nextMode =
        input.feeMode ?? (isFeeMode(data?.feeMode) ? (data.feeMode as ActivityFeeMode) : 'fixed');
      if (!resolved.isPaid) {
        (updates as Record<string, unknown>).feeMode = FieldValue.delete();
        (updates as Record<string, unknown>).totalCost = FieldValue.delete();
        (updates as Record<string, unknown>).minPlayers = FieldValue.delete();
      } else if (nextMode === 'split') {
        const capacity =
          (updates.capacity as number | undefined) ??
          (typeof data?.capacity === 'number' ? (data.capacity as number) : 10);
        const split = resolveSplitCost(
          nextMode,
          input.totalCost ??
            (typeof data?.totalCost === 'number' ? (data.totalCost as number) : undefined),
          input.minPlayers ??
            (Number.isInteger(data?.minPlayers) ? (data.minPlayers as number) : undefined),
          capacity,
        );
        (updates as Record<string, unknown>).feeMode = split.feeMode;
        if (split.totalCost !== undefined) {
          (updates as Record<string, unknown>).totalCost = split.totalCost;
          // Keep `fee` as the worst-case per-person price for old clients.
          (updates as Record<string, unknown>).fee =
            Math.round((split.totalCost / (split.minPlayers ?? capacity)) * 100) / 100;
        }
        if (split.minPlayers !== undefined) {
          (updates as Record<string, unknown>).minPlayers = split.minPlayers;
        }
      } else {
        (updates as Record<string, unknown>).feeMode = 'fixed';
        (updates as Record<string, unknown>).totalCost = FieldValue.delete();
        (updates as Record<string, unknown>).minPlayers = FieldValue.delete();
      }
    }

    transaction.update(activityRef, updates);
  });

  await notifyParticipantsOfUpdate(activityId, hostId, before, updates);
}

/** Notifies members (not the host) when an edit changes time, venue or capacity. Best-effort. */
async function notifyParticipantsOfUpdate(
  activityId: string,
  hostId: string,
  before: Record<string, unknown> | null,
  updates: Partial<ActivityRecord>,
): Promise<void> {
  const changed = new Set<string>();
  const differs = (key: string) =>
    (updates as Record<string, unknown>)[key] !== undefined &&
    (updates as Record<string, unknown>)[key] !== before?.[key];
  if (differs('startTime') || differs('endTime')) changed.add('time');
  if (
    differs('locationName') ||
    differs('address') ||
    differs('latitude') ||
    differs('longitude') ||
    differs('geohash')
  ) {
    changed.add('the venue');
  }
  if (differs('capacity')) changed.add('capacity');
  if (changed.size === 0) return;

  let roster: { uid: unknown }[] = [];
  try {
    roster = await getParticipants(activityId);
  } catch {
    return;
  }
  const recipients = [
    ...new Set(
      roster
        .map((p) => p.uid)
        .filter((uid): uid is string => typeof uid === 'string' && !!uid && uid !== hostId),
    ),
  ];
  if (recipients.length === 0) return;

  const summary = [...changed].join(' and ');
  const title =
    typeof updates.title === 'string' && updates.title
      ? updates.title
      : typeof before?.title === 'string' && before.title
        ? before.title
        : 'Your activity';
  try {
    const template = await renderTemplate('activity.updated', {
      activityName: title,
      changeSummary: summary,
    });
    await Promise.all(
      recipients.map((uid) =>
        createNotification({
          recipientUid: uid,
          type: 'activity_updated',
          title: template?.title ?? 'Activity updated',
          body:
            template?.body ??
            `“${title}” updated: ${summary} changed — tap for the latest details.`,
          activityId,
          audience: 'member',
        }).catch(() => undefined),
      ),
    );
  } catch {
    // Best-effort.
  }
}
