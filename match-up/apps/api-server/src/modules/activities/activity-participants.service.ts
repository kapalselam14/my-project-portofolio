import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import {
  activityAttendanceCollectionPath,
  activityDocPath,
  activityJoinRequestDocPath,
  activityJoinRequestsCollectionPath,
  activityParticipantDocPath,
  activityParticipantsCollectionPath,
} from '../../database/paths.js';
import type { ActivityStatus } from './activities.service.js';
import { getPublicUserProfile, type PublicUserProfile } from '../users/users.service.js';
import { createNotification } from '../notifications/notifications.service.js';

export type ActivityParticipantRecord = {
  uid: string;
  joinedAt: FirebaseFirestore.Timestamp;
};

export type LeaveActivityInput = {
  activityId: string;
  targetUid: string;
  actorUid: string;
};

export type ActivityParticipantWithId = ActivityParticipantRecord & {
  participantId: string;
  profile: PublicUserProfile | null;
  /** True when this row is the activity host. */
  isOrganizer: boolean;
  /** True when an attendance row exists (checked in). */
  isCheckedIn: boolean;
};

type ActivityParticipantBaseWithId = ActivityParticipantRecord & {
  participantId: string;
  isOrganizer: boolean;
  isCheckedIn: boolean;
};

/** Refuse new participation once the activity has started or its start timestamp is invalid. */
function assertJoinableStartTime(activityData: FirebaseFirestore.DocumentData): void {
  const raw = activityData?.startTime;
  const startMs = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
  if (!Number.isNaN(startMs) && startMs <= Date.now()) {
    throw new Error('Activity has already started');
  }
}

// Enforce status, capacity, and duplicate membership together before adding a participant.
export async function joinActivity(activityId: string, uid: string): Promise<void> {
  const normalizedActivityId = activityId.trim();
  const normalizedUid = uid.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const activityRef = firestore.doc(activityDocPath(normalizedActivityId));
  const participantRef = firestore.doc(
    activityParticipantDocPath(normalizedActivityId, normalizedUid),
  );

  await firestore.runTransaction(async (transaction) => {
    const now = Timestamp.now();

    const activitySnap = await transaction.get(activityRef);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const activityData = activitySnap.data();

    if (!activityData) {
      throw new Error('Activity not found');
    }

    if (typeof activityData.status !== 'string') {
      throw new Error('Invalid activity record: status must be a string');
    }

    if (typeof activityData.capacity !== 'number') {
      throw new Error('Invalid activity record: capacity must be a number');
    }

    if (typeof activityData.participantCount !== 'number') {
      throw new Error('Invalid activity record: participantCount must be a number');
    }

    if (activityData.status !== 'open') {
      throw new Error('Activity is not open for joining');
    }

    assertJoinableStartTime(activityData);

    if (activityData.joinPolicy === 'approval') {
      throw new Error('This activity requires host approval — request to join instead');
    }

    if (activityData.participantCount >= activityData.capacity) {
      throw new Error('Activity is full');
    }

    const participantSnap = await transaction.get(participantRef);

    if (participantSnap.exists) {
      throw new Error('User already joined this activity');
    }

    transaction.set(participantRef, {
      uid: normalizedUid,
      joinedAt: now,
    } satisfies ActivityParticipantRecord);

    const nextParticipantCount = activityData.participantCount + 1;
    const nextStatus: ActivityStatus =
      nextParticipantCount >= activityData.capacity ? 'full' : 'open';

    transaction.update(activityRef, {
      participantCount: nextParticipantCount,
      status: nextStatus,
      updatedAt: now,
    });
  });
}

// Return roster rows enriched with the public profile fields needed by clients.
export async function getParticipants(activityId: string): Promise<ActivityParticipantWithId[]> {
  const normalizedActivityId = activityId.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  const [participantsSnap, activitySnap, attendanceSnap] = await Promise.all([
    firestore.collection(activityParticipantsCollectionPath(normalizedActivityId)).get(),
    firestore.doc(activityDocPath(normalizedActivityId)).get(),
    firestore.collection(activityAttendanceCollectionPath(normalizedActivityId)).get(),
  ]);

  const hostData = activitySnap.exists ? activitySnap.data() : undefined;
  const hostId = typeof hostData?.hostId === 'string' ? hostData.hostId : null;
  const checkedInUids = new Set(attendanceSnap.docs.map((doc) => doc.id));

  const participants = participantsSnap.docs.map((doc) => {
    const data = doc.data();

    if (typeof data.uid !== 'string') {
      throw new Error('Invalid participant record: uid must be a string');
    }

    if (!data.joinedAt || typeof data.joinedAt !== 'object' || !('toDate' in data.joinedAt)) {
      throw new Error('Invalid participant record: joinedAt must be a Firestore Timestamp');
    }

    return {
      participantId: doc.id,
      uid: data.uid,
      joinedAt: data.joinedAt as FirebaseFirestore.Timestamp,
      isOrganizer: hostId !== null && data.uid === hostId,
      isCheckedIn: checkedInUids.has(data.uid),
    };
  });

  return Promise.all(participants.map(enrichParticipantWithProfile));
}

async function enrichParticipantWithProfile(
  participant: ActivityParticipantBaseWithId,
): Promise<ActivityParticipantWithId> {
  const profile = await getPublicUserProfile(participant.uid);

  return {
    ...participant,
    profile,
  };
}

// Only the host and confirmed participants can access an activity's chat.
export async function canAccessActivityChat(activityId: string, uid: string): Promise<boolean> {
  const normalizedActivityId = activityId.trim();
  const normalizedUid = uid.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const activityRef = firestore.doc(activityDocPath(normalizedActivityId));
  const participantRef = firestore.doc(
    activityParticipantDocPath(normalizedActivityId, normalizedUid),
  );

  const [activitySnap, participantSnap] = await Promise.all([
    activityRef.get(),
    participantRef.get(),
  ]);

  if (!activitySnap.exists) {
    throw new Error('Activity not found');
  }

  const activityData = activitySnap.data();

  if (!activityData || typeof activityData.hostId !== 'string') {
    throw new Error('Invalid activity record: hostId must be a string');
  }

  return activityData.hostId === normalizedUid || participantSnap.exists;
}

// Remove membership and keep the activity participant counter synchronized transactionally.
export async function leaveActivity(input: LeaveActivityInput): Promise<void> {
  const normalizedActivityId = input.activityId.trim();
  const normalizedTargetUid = input.targetUid.trim();
  const normalizedActorUid = input.actorUid.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  if (!normalizedTargetUid) {
    throw new Error('targetUid is required');
  }

  if (!normalizedActorUid) {
    throw new Error('actorUid is required');
  }

  const activityRef = firestore.doc(activityDocPath(normalizedActivityId));
  const participantRef = firestore.doc(
    activityParticipantDocPath(normalizedActivityId, normalizedTargetUid),
  );

  // Withdrawing a *pending* request is not a membership change: the requester was never counted.
  if (normalizedActorUid === normalizedTargetUid) {
    const [memberSnap, pendingSnap] = await Promise.all([
      participantRef.get(),
      firestore.doc(activityJoinRequestDocPath(normalizedActivityId, normalizedTargetUid)).get(),
    ]);

    if (!memberSnap.exists && pendingSnap.exists && pendingSnap.data()?.status === 'pending') {
      const batch = firestore.batch();
      batch.delete(
        firestore.doc(activityJoinRequestDocPath(normalizedActivityId, normalizedTargetUid)),
      );
      // Keep the denormalized waiting-list counter in sync.
      batch.update(activityRef, {
        pendingRequestCount: FieldValue.increment(-1),
      });
      await batch.commit();
      return;
    }
  }

  await firestore.runTransaction(async (transaction) => {
    const now = Timestamp.now();

    const activitySnap = await transaction.get(activityRef);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const activityData = activitySnap.data();

    if (!activityData) {
      throw new Error('Activity not found');
    }

    if (typeof activityData.capacity !== 'number') {
      throw new Error('Invalid activity record: capacity must be a number');
    }

    if (typeof activityData.participantCount !== 'number') {
      throw new Error('Invalid activity record: participantCount must be a number');
    }

    if (typeof activityData.status !== 'string') {
      throw new Error('Invalid activity record: status must be a string');
    }

    if (typeof activityData.hostId !== 'string') {
      throw new Error('Invalid activity record: hostId must be a string');
    }

    const isSelfRemoval = normalizedActorUid === normalizedTargetUid;
    const isHostRemoval = activityData.hostId === normalizedActorUid;

    if (!isSelfRemoval && !isHostRemoval) {
      throw new Error('Only the participant or activity host can remove this participant');
    }

    const isHostSelfRemoval =
      activityData.hostId === normalizedActorUid && normalizedActorUid === normalizedTargetUid;
    const participantSnap = await transaction.get(participantRef);

    if (!participantSnap.exists && !isHostSelfRemoval) {
      throw new Error('Participant not found');
    }

    if (participantSnap.exists) {
      transaction.delete(participantRef);
    }

    const nextParticipantCount = participantSnap.exists
      ? Math.max(activityData.participantCount - 1, 0)
      : activityData.participantCount;

    let nextStatus = activityData.status as ActivityStatus;

    if (isHostSelfRemoval) {
      nextStatus = 'cancelled';
    } else if (activityData.status === 'full' && nextParticipantCount < activityData.capacity) {
      nextStatus = 'open';
    }

    transaction.update(activityRef, {
      participantCount: nextParticipantCount,
      status: nextStatus,
      ...(isHostSelfRemoval ? { cancelledAt: now, cancelledBy: normalizedActorUid } : {}),
      updatedAt: now,
    });
  });
}

export type JoinRequestStatus = 'pending' | 'approved' | 'declined';

export type JoinRequestRecord = {
  uid: string;
  activityId: string;
  status: JoinRequestStatus;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  decidedBy?: string;
  decidedAt?: FirebaseFirestore.Timestamp;
};

export type JoinRequestWithId = JoinRequestRecord & {
  requestId: string;
  profile: PublicUserProfile | null;
};

/** Approval-gated activities track join requests separately from confirmed participants. */
export async function requestToJoin(activityId: string, uid: string): Promise<void> {
  const normalizedActivityId = activityId.trim();
  const normalizedUid = uid.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const activityRef = firestore.doc(activityDocPath(normalizedActivityId));
  const participantRef = firestore.doc(
    activityParticipantDocPath(normalizedActivityId, normalizedUid),
  );
  const requestRef = firestore.doc(activityJoinRequestDocPath(normalizedActivityId, normalizedUid));

  await firestore.runTransaction(async (transaction) => {
    const now = Timestamp.now();
    const [activitySnap, participantSnap, requestSnap] = await Promise.all([
      transaction.get(activityRef),
      transaction.get(participantRef),
      transaction.get(requestRef),
    ]);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const activityData = activitySnap.data();

    if (!activityData || typeof activityData.hostId !== 'string') {
      throw new Error('Invalid activity record: hostId must be a string');
    }

    if (activityData.hostId === normalizedUid) {
      throw new Error('The host is already in this activity');
    }

    if (activityData.status !== 'open') {
      throw new Error('Activity is not open for joining');
    }

    assertJoinableStartTime(activityData);

    if (activityData.joinPolicy !== 'approval') {
      throw new Error('This activity does not require approval — join directly');
    }

    if (participantSnap.exists) {
      throw new Error('User already joined this activity');
    }

    const existingStatus = requestSnap.exists
      ? (requestSnap.data()?.status as string | undefined)
      : undefined;

    if (existingStatus === 'pending') {
      throw new Error('Join request already pending');
    }

    transaction.set(requestRef, {
      uid: normalizedUid,
      activityId: normalizedActivityId,
      status: 'pending',
      createdAt:
        requestSnap.exists && requestSnap.data()?.createdAt
          ? (requestSnap.data() as { createdAt: FirebaseFirestore.Timestamp }).createdAt
          : now,
      updatedAt: now,
    } satisfies JoinRequestRecord);

    // Denormalized waiting-list counter for the public "N waiting" display.
    transaction.update(activityRef, {
      pendingRequestCount: FieldValue.increment(1),
      updatedAt: now,
    });
  });

  const activitySnap = await activityRef.get();
  const hostId = activitySnap.data()?.hostId;

  if (typeof hostId === 'string' && hostId !== normalizedUid) {
    await createNotification({
      recipientUid: hostId,
      type: 'join_request',
      title: 'New join request',
      body: 'Someone requested to join your activity',
      activityId: normalizedActivityId,
      senderUid: normalizedUid,
    });
  }
}

export async function listJoinRequests(activityId: string): Promise<JoinRequestWithId[]> {
  const normalizedActivityId = activityId.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  const snap = await firestore
    .collection(activityJoinRequestsCollectionPath(normalizedActivityId))
    .where('status', '==', 'pending')
    .get();

  return Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      const profile = typeof data.uid === 'string' ? await getPublicUserProfile(data.uid) : null;

      return {
        requestId: doc.id,
        uid: typeof data.uid === 'string' ? data.uid : '',
        activityId: normalizedActivityId,
        status: 'pending' as const,
        createdAt: data.createdAt as FirebaseFirestore.Timestamp,
        updatedAt: data.updatedAt as FirebaseFirestore.Timestamp,
        profile,
      };
    }),
  );
}

async function decideJoinRequest(
  activityId: string,
  targetUid: string,
  actorUid: string,
  decision: 'approved' | 'declined',
): Promise<void> {
  const normalizedActivityId = activityId.trim();
  const normalizedTargetUid = targetUid.trim();
  const normalizedActorUid = actorUid.trim();

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  if (!normalizedTargetUid) {
    throw new Error('uid is required');
  }

  if (!normalizedActorUid) {
    throw new Error('actorUid is required');
  }

  const activityRef = firestore.doc(activityDocPath(normalizedActivityId));
  const requestRef = firestore.doc(
    activityJoinRequestDocPath(normalizedActivityId, normalizedTargetUid),
  );
  const participantRef = firestore.doc(
    activityParticipantDocPath(normalizedActivityId, normalizedTargetUid),
  );

  await firestore.runTransaction(async (transaction) => {
    const now = Timestamp.now();
    const [activitySnap, requestSnap, participantSnap] = await Promise.all([
      transaction.get(activityRef),
      transaction.get(requestRef),
      transaction.get(participantRef),
    ]);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const activityData = activitySnap.data();

    if (!activityData || typeof activityData.hostId !== 'string') {
      throw new Error('Invalid activity record: hostId must be a string');
    }

    if (activityData.hostId !== normalizedActorUid) {
      throw new Error('Only the activity host can decide join requests');
    }

    if (!requestSnap.exists || requestSnap.data()?.status !== 'pending') {
      throw new Error('Join request not found');
    }

    if (decision === 'declined') {
      transaction.update(requestRef, {
        status: 'declined',
        decidedBy: normalizedActorUid,
        decidedAt: now,
        updatedAt: now,
      });
      transaction.update(activityRef, {
        pendingRequestCount: FieldValue.increment(-1),
        updatedAt: now,
      });
      return;
    }

    if (typeof activityData.capacity !== 'number') {
      throw new Error('Invalid activity record: capacity must be a number');
    }

    if (typeof activityData.participantCount !== 'number') {
      throw new Error('Invalid activity record: participantCount must be a number');
    }

    if (activityData.status !== 'open') {
      throw new Error('Activity is not open for joining');
    }

    if (activityData.participantCount >= activityData.capacity) {
      throw new Error('Activity is full');
    }

    if (!participantSnap.exists) {
      transaction.set(participantRef, {
        uid: normalizedTargetUid,
        joinedAt: now,
      });
    }

    const nextParticipantCount = participantSnap.exists
      ? activityData.participantCount
      : activityData.participantCount + 1;

    transaction.update(activityRef, {
      participantCount: nextParticipantCount,
      status: nextParticipantCount >= activityData.capacity ? 'full' : 'open',
      pendingRequestCount: FieldValue.increment(-1),
      updatedAt: now,
    });
    transaction.update(requestRef, {
      status: 'approved',
      decidedBy: normalizedActorUid,
      decidedAt: now,
      updatedAt: now,
    });
  });

  await createNotification({
    recipientUid: normalizedTargetUid,
    type: decision === 'approved' ? 'activity_joined' : 'system',
    title: decision === 'approved' ? 'Request approved' : 'Request declined',
    body:
      decision === 'approved'
        ? 'The host approved your request — see you there!'
        : 'The host declined your join request for this activity.',
    activityId: normalizedActivityId,
    senderUid: normalizedActorUid,
    // The approved joiner opens their joined view, not the discover detail.
    ...(decision === 'approved' ? { audience: 'member' as const } : {}),
  });
}

// Consume a pending request and add its member only if capacity still permits it.
export async function approveJoinRequest(
  activityId: string,
  targetUid: string,
  actorUid: string,
): Promise<void> {
  await decideJoinRequest(activityId, targetUid, actorUid, 'approved');
}

// Decline the request and decrement the activity's denormalized pending-request count.
export async function declineJoinRequest(
  activityId: string,
  targetUid: string,
  actorUid: string,
): Promise<void> {
  await decideJoinRequest(activityId, targetUid, actorUid, 'declined');
}

export type MyJoinRequestView = {
  activityId: string;
  title: string;
  sportType: string;
  locationName: string;
  startTime: string | null;
  status: 'pending';
  requestedAt: FirebaseFirestore.Timestamp | null;
  /** Cover for the Pending tab thumbnail; absent when unset. */
  coverImageUrl?: string;
  /** Paid flag + fee, so rows render the correct chip without refetch. */
  isPaid?: boolean;
  fee?: number;
};

/** Join a user's request records back to their activities for the pending-request view. */
export async function listMyJoinRequests(viewerUid: string): Promise<MyJoinRequestView[]> {
  const normalizedUid = viewerUid.trim();
  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const snap = await firestore
    .collectionGroup('joinRequests')
    .where('uid', '==', normalizedUid)
    .get();

  const views: MyJoinRequestView[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.status !== 'pending') continue;
    const activityId =
      typeof data.activityId === 'string' && data.activityId
        ? data.activityId
        : doc.ref.parent.parent?.id;
    if (!activityId) continue;

    let title = '';
    let sportType = '';
    let locationName = '';
    let startTime: string | null = null;
    let coverImageUrl: string | undefined;
    let isPaid: boolean | undefined;
    let fee: number | undefined;
    try {
      const activitySnap = await firestore.doc(activityDocPath(activityId)).get();
      const a = activitySnap.exists ? activitySnap.data() : undefined;
      if (typeof a?.title === 'string') title = a.title;
      if (typeof a?.sportType === 'string') sportType = a.sportType;
      if (typeof a?.locationName === 'string') locationName = a.locationName;
      if (typeof a?.startTime === 'string') startTime = a.startTime;
      if (typeof a?.coverImageUrl === 'string' && a.coverImageUrl) {
        coverImageUrl = a.coverImageUrl;
      }
      if (typeof a?.isPaid === 'boolean') isPaid = a.isPaid;
      if (typeof a?.fee === 'number' && Number.isFinite(a.fee) && a.fee > 0) {
        fee = a.fee;
      }
    } catch {
      // Best-effort enrichment — the row still renders from ids.
    }

    views.push({
      activityId,
      title,
      sportType,
      locationName,
      startTime,
      status: 'pending',
      requestedAt: (data.createdAt as FirebaseFirestore.Timestamp | undefined) ?? null,
      ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
      ...(isPaid !== undefined ? { isPaid } : {}),
      ...(fee !== undefined ? { fee } : {}),
    });
  }

  // Soonest event first (rows without a parseable start go last).
  views.sort((a, b) => {
    const aMs = a.startTime !== null ? Date.parse(a.startTime) : Number.NaN;
    const bMs = b.startTime !== null ? Date.parse(b.startTime) : Number.NaN;
    if (Number.isNaN(aMs)) return Number.isNaN(bMs) ? 0 : 1;
    if (Number.isNaN(bMs)) return -1;
    return aMs - bMs;
  });

  return views;
}
