import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import {
  activityDocPath,
  activityParticipantDocPath,
  activityRatingDocPath,
} from '../../database/paths.js';
import { getActivityById } from '../activities/activities.service.js';

export type ParticipantRatingInput = {
  rateeUid: string;
  stars: number;
};

export type SubmitActivityRatingInput = {
  activityId: string;
  raterUid: string;
  sportType?: string;
  comment?: string;
  activityStars?: number;
  participantRatings: ParticipantRatingInput[];
};

export type RatedParticipant = {
  rateeUid: string;
  stars: number;
  /** True when the ratee hosted this activity. */
  wasHost: boolean;
};

export type ActivityRatingRecord = {
  raterUid: string;
  activityId: string;
  sportType: string;
  comment?: string;
  activityStars?: number;
  ratings: RatedParticipant[];
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

export type ActivityRatingWithId = ActivityRatingRecord & {
  ratingId: string;
};

export type SportRatingAggregate = {
  average: number;
  count: number;
};

/** Submissions are accepted up to 7 days after the activity ends. */
const RATING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_COMMENT_LENGTH = 500;

function assertStars(stars: unknown, rateeUid: string): asserts stars is number {
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error(`Invalid rating for ${rateeUid}: stars must be an integer between 1 and 5`);
  }
}

function resolveWindowEndMs(activity: { startTime: string; endTime?: string }): number {
  const endRaw = activity.endTime ?? activity.startTime;
  const endMs = Date.parse(endRaw);
  if (Number.isNaN(endMs)) {
    throw new Error('Invalid activity record: endTime must be a date string');
  }
  return endMs + RATING_WINDOW_MS;
}

export async function submitActivityRating(
  input: SubmitActivityRatingInput,
): Promise<{ ratingId: string; updated: boolean }> {
  const activityId = input.activityId.trim();
  const raterUid = input.raterUid.trim();
  const comment = input.comment?.trim();

  if (!activityId) {
    throw new Error('activityId is required');
  }

  if (!raterUid) {
    throw new Error('raterUid is required');
  }

  if (!Array.isArray(input.participantRatings)) {
    throw new Error('participantRatings must be an array');
  }

  const activity = await getActivityById(activityId);

  if (!activity) {
    throw new Error('Activity not found');
  }

  if (activity.status !== 'completed') {
    throw new Error('Activity must be completed before it can be rated');
  }

  if (Date.now() > resolveWindowEndMs(activity)) {
    throw new Error('Rating window has closed for this activity');
  }

  const sportType = (input.sportType?.trim() || activity.sportType).trim();

  if (!sportType) {
    throw new Error('sportType is required');
  }

  const trimmedComment = comment ? comment.slice(0, MAX_COMMENT_LENGTH) : undefined;

  let activityStars: number | undefined;
  if (input.activityStars !== undefined) {
    assertStars(input.activityStars, 'activity');
    activityStars = input.activityStars;
  }

  const ratings: RatedParticipant[] = input.participantRatings.map((entry) => {
    if (!entry || typeof entry.rateeUid !== 'string' || !entry.rateeUid.trim()) {
      throw new Error('Each participant rating must include a rateeUid');
    }

    const rateeUid = entry.rateeUid.trim();

    if (rateeUid === raterUid) {
      throw new Error('You cannot rate yourself');
    }

    assertStars(entry.stars, rateeUid);

    return { rateeUid, stars: entry.stars, wasHost: rateeUid === activity.hostId };
  });

  // Check both the reviewer and every reviewed person against the activity roster.
  const involvedUids = new Set<string>([raterUid, ...ratings.map((r) => r.rateeUid)]);
  const membershipSnaps = await Promise.all(
    [...involvedUids].map((uid) =>
      firestore.doc(activityParticipantDocPath(activityId, uid)).get(),
    ),
  );
  const members = new Set<string>();
  [...involvedUids].forEach((uid, index) => {
    const snap = membershipSnaps[index];
    if ((snap !== undefined && snap.exists) || uid === activity.hostId) {
      members.add(uid);
    }
  });

  if (!members.has(raterUid)) {
    throw new Error('Only the host or participants can rate this activity');
  }

  for (const rating of ratings) {
    if (!members.has(rating.rateeUid)) {
      throw new Error(`User ${rating.rateeUid} did not take part in this activity`);
    }
  }

  const now = Timestamp.now();
  const ratingRef = firestore.doc(activityRatingDocPath(activityId, raterUid));
  const hostUid = activity.hostId;

  const updated = await firestore.runTransaction(async (transaction) => {
    const ratingSnap = await transaction.get(ratingRef);
    const previous = ratingSnap.exists
      ? (ratingSnap.data() as Partial<ActivityRatingRecord>)
      : null;
    const previousRatings: RatedParticipant[] = Array.isArray(previous?.ratings)
      ? (previous!.ratings as RatedParticipant[])
      : [];

    // Replacements must remove the old contribution before adding the new one to each aggregate.
    const affectedRatees = new Set<string>([
      ...previousRatings.map((r) => r.rateeUid),
      ...ratings.map((r) => r.rateeUid),
    ]);

    const userRefs = [...affectedRatees].map((uid) => firestore.doc(`users/${uid}`));
    const userSnaps = await Promise.all(userRefs.map((ref) => transaction.get(ref)));

    transaction.set(ratingRef, {
      raterUid,
      activityId,
      sportType,
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      ...(activityStars !== undefined ? { activityStars } : {}),
      ratings,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    } satisfies ActivityRatingRecord);

    // Fold the old submission out and the new one in, preserving correct averages on resubmission.
    const isHostRole = (rateeUid: string, wasHost?: boolean): boolean =>
      wasHost ?? rateeUid === hostUid;
    const previousByRatee = new Map(
      previousRatings.map((r) => [
        r.rateeUid,
        { stars: r.stars, wasHost: isHostRole(r.rateeUid, r.wasHost) },
      ]),
    );
    const nextByRatee = new Map(
      ratings.map((r) => [r.rateeUid, { stars: r.stars, wasHost: r.wasHost }]),
    );

    const affectedList = [...affectedRatees];
    userRefs.forEach((userRef, index) => {
      const rateeUid = affectedList[index];
      const userSnap = userSnaps[index];
      if (rateeUid === undefined || userSnap === undefined) {
        throw new Error('Internal error while updating rating aggregates');
      }
      const userData = userSnap.data() ?? {};
      const buckets = (userData.ratingBySport ?? {}) as Record<string, SportRatingAggregate>;
      const bucket = buckets[sportType] ?? { average: 0, count: 0 };

      let sum = bucket.average * bucket.count;
      let count = bucket.count;

      const oldEntry = previousByRatee.get(rateeUid);
      if (oldEntry !== undefined) {
        sum -= oldEntry.stars;
        count -= 1;
      }

      const newEntry = nextByRatee.get(rateeUid);
      if (newEntry !== undefined) {
        sum += newEntry.stars;
        count += 1;
      }

      const totalCount =
        typeof userData.totalRatingCount === 'number' ? userData.totalRatingCount : 0;
      const totalDelta = (newEntry !== undefined ? 1 : 0) - (oldEntry !== undefined ? 1 : 0);

      // Host-role fold: same stars, separate buckets, only when the ratee hosted this activity.
      const hostBuckets = (userData.hostRatingBySport ?? {}) as Record<
        string,
        SportRatingAggregate
      >;
      const hostBucket = hostBuckets[sportType] ?? { average: 0, count: 0 };
      let hostSum = hostBucket.average * hostBucket.count;
      let hostCount = hostBucket.count;
      if (oldEntry !== undefined && oldEntry.wasHost) {
        hostSum -= oldEntry.stars;
        hostCount -= 1;
      }
      if (newEntry !== undefined && newEntry.wasHost) {
        hostSum += newEntry.stars;
        hostCount += 1;
      }
      const totalHostCount =
        typeof userData.totalHostRatingCount === 'number' ? userData.totalHostRatingCount : 0;
      const hostDelta =
        (newEntry !== undefined && newEntry.wasHost ? 1 : 0) -
        (oldEntry !== undefined && oldEntry.wasHost ? 1 : 0);

      transaction.set(
        userRef,
        {
          ratingBySport: {
            ...buckets,
            [sportType]: {
              average: count > 0 ? sum / count : 0,
              count: Math.max(count, 0),
            },
          },
          totalRatingCount: Math.max(totalCount + totalDelta, 0),
          hostRatingBySport: {
            ...hostBuckets,
            [sportType]: {
              average: hostCount > 0 ? hostSum / hostCount : 0,
              count: Math.max(hostCount, 0),
            },
          },
          totalHostRatingCount: Math.max(totalHostCount + hostDelta, 0),
          updatedAt: now,
        },
        { merge: true },
      );
    });

    return ratingSnap.exists;
  });

  return { ratingId: raterUid, updated };
}

export async function getUserRating(
  activityId: string,
  raterUid: string,
): Promise<ActivityRatingWithId | null> {
  const normalizedActivityId = activityId.trim();
  const normalizedRaterUid = raterUid.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  if (!normalizedRaterUid) {
    throw new Error('raterUid is required');
  }

  const ratingDoc = await firestore
    .doc(activityRatingDocPath(normalizedActivityId, normalizedRaterUid))
    .get();

  if (!ratingDoc.exists) {
    return null;
  }

  const data = ratingDoc.data();

  if (!data) return null;

  return {
    ratingId: ratingDoc.id,
    raterUid: data.raterUid,
    activityId: data.activityId,
    sportType: data.sportType,
    ...(typeof data.comment === 'string' ? { comment: data.comment } : {}),
    ...(typeof data.activityStars === 'number' ? { activityStars: data.activityStars } : {}),
    ratings: Array.isArray(data.ratings) ? data.ratings : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function hasUserRated(activityId: string, raterUid: string): Promise<boolean> {
  return (await getUserRating(activityId, raterUid)) !== null;
}
