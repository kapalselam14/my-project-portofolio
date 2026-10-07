import { firestore } from '../../database/firebase.js';
import { activityJoinRequestDocPath, activityParticipantDocPath } from '../../database/paths.js';
import { getPublicUserProfile } from '../users/users.service.js';
import { getSwipeDecision } from '../swipes/swipes.service.js';
import type {
  ActivityBaseWithId,
  ActivityWithId,
  ActivityViewerContext,
  ActivityWithViewerContext,
  JoinRequestStatus,
} from './activities.service.js';

// Viewer enrichment: host profiles and per-viewer context.

export async function enrichActivityWithHostProfile(
  activity: ActivityBaseWithId,
): Promise<ActivityWithId> {
  // Attach only the public host projection, not the full user document.
  const hostProfile = await getPublicUserProfile(activity.hostId);

  return {
    ...activity,
    hostProfile,
  };
}

export async function getViewerActivityContext(
  activity: ActivityWithId,
  uid: string,
): Promise<ActivityViewerContext> {
  // Combine participation, host, swipe, and join-request state for this viewer.
  const normalizedUid = uid.trim();

  if (!normalizedUid) {
    throw new Error('uid is required');
  }

  const [swipe, participantSnap, requestSnap] = await Promise.all([
    getSwipeDecision(normalizedUid, activity.activityId),
    firestore.doc(activityParticipantDocPath(activity.activityId, normalizedUid)).get(),
    firestore.doc(activityJoinRequestDocPath(activity.activityId, normalizedUid)).get(),
  ]);

  const requestData = requestSnap.exists ? requestSnap.data() : undefined;
  const joinRequestStatus: JoinRequestStatus =
    requestData?.status === 'pending' ||
    requestData?.status === 'approved' ||
    requestData?.status === 'declined'
      ? requestData.status
      : 'none';

  return {
    mySwipeDecision: swipe?.decision ?? null,
    isParticipant: participantSnap.exists,
    isHost: activity.hostId === normalizedUid,
    joinRequestStatus,
  };
}

export async function attachViewerActivityContext(
  activity: ActivityWithId,
  uid: string,
): Promise<ActivityWithViewerContext> {
  const viewerContext = await getViewerActivityContext(activity, uid);

  return {
    ...activity,
    ...viewerContext,
  };
}
