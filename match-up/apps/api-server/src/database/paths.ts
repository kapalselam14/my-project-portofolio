export const COLLECTIONS = {
  users: 'users',
  activities: 'activities',
  swipes: 'swipes',
  reports: 'reports',
  adminActions: 'adminActions',
  mediaAssets: 'mediaAssets',
} as const;

export const SUBCOLLECTIONS = {
  devices: 'devices',
  participants: 'participants',
  decisions: 'decisions',
  notifications: 'notifications',
} as const;

export const RTDB_PATHS = {
  activityChats: 'activityChats',
  dmChats: 'dmChats',
  userDMs: 'userDMs',
  typing: 'typing',
  presence: 'presence',
} as const;

export function userDocPath(uid: string): string {
  return `${COLLECTIONS.users}/${uid}`;
}

export function userDevicesCollectionPath(uid: string): string {
  return `${userDocPath(uid)}/${SUBCOLLECTIONS.devices}`;
}

export function userDeviceDocPath(uid: string, deviceId: string): string {
  return `${userDevicesCollectionPath(uid)}/${deviceId}`;
}

export function userNotificationsCollectionPath(uid: string): string {
  return `${userDocPath(uid)}/${SUBCOLLECTIONS.notifications}`;
}

export function userNotificationDocPath(uid: string, notificationId: string): string {
  return `${userNotificationsCollectionPath(uid)}/${notificationId}`;
}

export function activityDocPath(activityId: string): string {
  return `${COLLECTIONS.activities}/${activityId}`;
}

export function activityParticipantsCollectionPath(activityId: string): string {
  return `${activityDocPath(activityId)}/${SUBCOLLECTIONS.participants}`;
}

export function activityParticipantDocPath(activityId: string, uid: string): string {
  return `${activityParticipantsCollectionPath(activityId)}/${uid}`;
}

export function activityJoinRequestsCollectionPath(activityId: string): string {
  return `${activityDocPath(activityId)}/joinRequests`;
}

export function activityJoinRequestDocPath(activityId: string, uid: string): string {
  return `${activityJoinRequestsCollectionPath(activityId)}/${uid}`;
}

export function activityAttendanceCollectionPath(activityId: string): string {
  return `${activityDocPath(activityId)}/attendance`;
}

export function activityAttendanceDocPath(activityId: string, uid: string): string {
  return `${activityAttendanceCollectionPath(activityId)}/${uid}`;
}

export function activityRatingsCollectionPath(activityId: string): string {
  return `${activityDocPath(activityId)}/ratings`;
}

export function activityRatingDocPath(activityId: string, raterUid: string): string {
  return `${activityRatingsCollectionPath(activityId)}/${raterUid}`;
}

export function swipeDecisionsCollectionPath(uid: string): string {
  return `${COLLECTIONS.swipes}/${uid}/${SUBCOLLECTIONS.decisions}`;
}

export function swipeDecisionDocPath(uid: string, activityId: string): string {
  return `${swipeDecisionsCollectionPath(uid)}/${activityId}`;
}

export function reportDocPath(reportId: string): string {
  return `${COLLECTIONS.reports}/${reportId}`;
}

export function adminActionDocPath(actionId: string): string {
  return `${COLLECTIONS.adminActions}/${actionId}`;
}

export function mediaAssetDocPath(assetId: string): string {
  return `${COLLECTIONS.mediaAssets}/${assetId}`;
}

export function activityChatPath(activityId: string): string {
  return `${RTDB_PATHS.activityChats}/${activityId}`;
}

export function activityMessagesPath(activityId: string): string {
  return `${activityChatPath(activityId)}/messages`;
}

export function activityMessagePath(activityId: string, messageId: string): string {
  return `${activityMessagesPath(activityId)}/${messageId}`;
}

export function activityReactionsPath(activityId: string): string {
  return `${activityChatPath(activityId)}/reactions`;
}

export function activityMessageReactionsPath(activityId: string, messageId: string): string {
  return `${activityReactionsPath(activityId)}/${messageId}`;
}

export function activityReactionPath(
  activityId: string,
  messageId: string,
  emoji: string,
  uid: string,
): string {
  return `${activityMessageReactionsPath(activityId, messageId)}/${emoji}/${uid}`;
}

export function activityPollsPath(activityId: string): string {
  return `${activityChatPath(activityId)}/polls`;
}

export function activityPollPath(activityId: string, pollId: string): string {
  return `${activityPollsPath(activityId)}/${pollId}`;
}

export function activityPollVotesPath(activityId: string, pollId: string): string {
  return `${activityPollPath(activityId, pollId)}/votes`;
}

/** Canonical 1-on-1 thread id for two uids — sorted so both directions resolve to the same conversation. */
export function dmThreadId(uidA: string, uidB: string): string {
  const [first, second] = [uidA.trim(), uidB.trim()].sort();
  return `${first}_${second}`;
}

export function dmChatPath(uidA: string, uidB: string): string {
  return `${RTDB_PATHS.dmChats}/${dmThreadId(uidA, uidB)}`;
}

export function dmMessagesPath(uidA: string, uidB: string): string {
  return `${dmChatPath(uidA, uidB)}/messages`;
}

/** Inbox metadata for one user's DM threads: `userDMs/{uid}/{peerUid}`. */
export function userDmInboxPath(uid: string): string {
  return `${RTDB_PATHS.userDMs}/${uid.trim()}`;
}

export function userDmEntryPath(uid: string, peerUid: string): string {
  return `${userDmInboxPath(uid)}/${peerUid.trim()}`;
}

export function typingPath(activityId: string, uid: string): string {
  return `${RTDB_PATHS.typing}/${activityId}/${uid}`;
}

export function presencePath(uid: string): string {
  return `${RTDB_PATHS.presence}/${uid}`;
}
