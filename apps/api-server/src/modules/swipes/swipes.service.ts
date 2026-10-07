// Swipe persistence: one doc per user+activity, re-swiping overwrites. Transactional so a swipe on a deleted activity fails cleanly.
import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';
import {
  activityDocPath,
  swipeDecisionDocPath,
  swipeDecisionsCollectionPath,
} from '../../database/paths.js';

export type SwipeDecision = 'pass' | 'join';

export type CreateSwipeInput = {
  uid: string;
  activityId: string;
  decision: SwipeDecision;
};

export type SwipeDecisionRecord = {
  uid: string;
  activityId: string;
  decision: SwipeDecision;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

export type SwipeDecisionWithId = SwipeDecisionRecord & { swipeId: string };

export async function saveSwipeDecision(input: CreateSwipeInput): Promise<void> {
  const uid = input.uid.trim();
  const activityId = input.activityId.trim();
  const decision = input.decision;
  const now = Timestamp.now();

  if (!uid) {
    throw new Error('uid is required');
  }

  if (!activityId) {
    throw new Error('activityId is required');
  }

  if (decision !== 'pass' && decision !== 'join') {
    throw new Error('decision must be pass or join');
  }

  const activityRef = firestore.doc(activityDocPath(activityId));
  const swipeRef = firestore.doc(swipeDecisionDocPath(uid, activityId));

  await firestore.runTransaction(async (transaction) => {
    // Read the activity in the same transaction so a swipe cannot target a deleted activity.
    const activitySnap = await transaction.get(activityRef);

    if (!activitySnap.exists) {
      throw new Error('Activity not found');
    }

    const swipeSnap = await transaction.get(swipeRef);

    if (!swipeSnap.exists) {
      transaction.set(swipeRef, {
        uid,
        activityId,
        decision,
        createdAt: now,
        updatedAt: now,
      } satisfies SwipeDecisionRecord);

      return;
    }

    transaction.update(swipeRef, {
      decision,
      updatedAt: now,
    });
  });
}

export async function getSwipeDecision(
  uid: string,
  activityId: string,
): Promise<SwipeDecisionWithId | null> {
  const normalizedUid = uid.trim();
  const normalizedActivityId = activityId.trim();

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  if (!normalizedActivityId) {
    throw new Error('activityId is required');
  }

  const swipeDoc = await firestore
    .doc(swipeDecisionDocPath(normalizedUid, normalizedActivityId))
    .get();

  if (!swipeDoc.exists) {
    return null;
  }

  const data = swipeDoc.data();

  if (!data) return null;

  if (typeof data.uid !== 'string') {
    throw new Error('Invalid swipe record: uid must be a string');
  }

  if (typeof data.activityId !== 'string') {
    throw new Error('Invalid swipe record: activityId must be a string');
  }

  if (data.decision !== 'pass' && data.decision !== 'join') {
    throw new Error('Invalid swipe record: decision must be pass or join');
  }

  if (!data.createdAt || typeof data.createdAt !== 'object' || !('toDate' in data.createdAt)) {
    throw new Error('Invalid swipe record: createdAt must be a Firestore Timestamp');
  }

  if (!data.updatedAt || typeof data.updatedAt !== 'object' || !('toDate' in data.updatedAt)) {
    throw new Error('Invalid swipe record: updatedAt must be a Firestore Timestamp');
  }
  return {
    swipeId: swipeDoc.id,
    uid: data.uid,
    activityId: data.activityId,
    decision: data.decision,
    createdAt: data.createdAt as FirebaseFirestore.Timestamp,
    updatedAt: data.updatedAt as FirebaseFirestore.Timestamp,
  };
}

export async function listSwipeDecisions(uid: string): Promise<SwipeDecisionWithId[]> {
  const normalizedUid = uid.trim();

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const swipeSnap = await firestore
    .collection(swipeDecisionsCollectionPath(normalizedUid))
    .orderBy('updatedAt', 'desc')
    .get();

  return swipeSnap.docs.map((doc) => {
    const data = doc.data();

    if (typeof data.uid !== 'string') {
      throw new Error('Invalid swipe record: uid must be a string');
    }

    if (typeof data.activityId !== 'string') {
      throw new Error('Invalid swipe record: activityId must be a string');
    }

    if (data.decision !== 'pass' && data.decision !== 'join') {
      throw new Error('Invalid swipe record: decision must be pass or join');
    }

    if (!data.createdAt || typeof data.createdAt !== 'object' || !('toDate' in data.createdAt)) {
      throw new Error('Invalid swipe record: createdAt must be a Firestore Timestamp');
    }

    if (!data.updatedAt || typeof data.updatedAt !== 'object' || !('toDate' in data.updatedAt)) {
      throw new Error('Invalid swipe record: updatedAt must be a Firestore Timestamp');
    }

    return {
      swipeId: doc.id,
      uid: data.uid,
      activityId: data.activityId,
      decision: data.decision,
      createdAt: data.createdAt as FirebaseFirestore.Timestamp,
      updatedAt: data.updatedAt as FirebaseFirestore.Timestamp,
    };
  });
}
