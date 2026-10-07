/** MatchUp database seed script. */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { auth, firestore, rtdb } from '../database/firebase.js';
import { env } from '../config/env.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MOBILE_ASSETS = join(REPO_ROOT, 'apps', 'mobile', 'assets', 'images', 'discovery');

// Config.

const DEMO_PASSWORD = 'MatchUp123!';

type SeedUser = {
  key: string;
  email: string;
  displayName: string;
  bio: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'any';
  preferredSports: string[];
  preferredLocations: string[];
  /** Bundled asset (relative to the discovery image dir) uploaded as the user's `photoUrl`. */
  avatarFile: string;
};

const USERS: SeedUser[] = [
  {
    key: 'alex',
    email: 'alex.mercer@matchup.demo',
    displayName: 'Alex Mercer',
    bio: 'Love weekend runs and pickup basketball.',
    skillLevel: 'intermediate',
    preferredSports: ['Basketball', 'Football', 'Running'],
    preferredLocations: ['Auckland CBD', 'Eden Park'],
    avatarFile: 'avatars/msg_alex.png',
  },
  {
    key: 'sarah',
    email: 'sarah.chen@matchup.demo',
    displayName: 'Sarah Chen',
    bio: 'Tennis tragic. Always bring spare balls.',
    skillLevel: 'intermediate',
    preferredSports: ['Tennis', 'Volleyball'],
    preferredLocations: ['Parnell', 'Auckland Domain'],
    avatarFile: 'avatars/sarah_c.png',
  },
  {
    key: 'mike',
    email: 'mike.chen@matchup.demo',
    displayName: 'Mike Chen',
    bio: 'Trail runner. Dawn patrol regular at Cornwall Park.',
    skillLevel: 'advanced',
    preferredSports: ['Running', 'Tennis'],
    preferredLocations: ['Cornwall Park', 'Onehunga'],
    avatarFile: 'avatars/mike_c.png',
  },
  {
    key: 'lisa',
    email: 'lisa.park@matchup.demo',
    displayName: 'Lisa Park',
    bio: 'Volleyball setter. Indoor co-ed 6v6 every week.',
    skillLevel: 'advanced',
    preferredSports: ['Volleyball', 'Basketball'],
    preferredLocations: ['North Shore', 'Takapuna'],
    avatarFile: 'avatars/lisa_p.png',
  },
  {
    key: 'james',
    email: 'james.wilson@matchup.demo',
    displayName: 'James Wilson',
    bio: 'Weekend warrior. Organizing pickup games since 2019.',
    skillLevel: 'advanced',
    preferredSports: ['Basketball', 'Tennis'],
    preferredLocations: ['Auckland Domain', 'Mission Bay'],
    avatarFile: 'avatars/host_james.png',
  },
];

type SeedActivity = {
  id: string;
  hostKey: string;
  title: string;
  sportType: string;
  description: string;
  locationName: string;
  address: string;
  latitude: number;
  longitude: number;
  startInDays: number;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'any';
  capacity: number;
  status: 'open' | 'full' | 'completed';
  memberKeys: string[];
  /** Bundled cover asset (relative to the discovery image dir) uploaded as the activity's `coverImageUrl`. */
  coverFile?: string;
  /** 'approval' parks joiners in a pending request; omit for instant join. */
  joinPolicy?: 'approval';
  /** Flat per-person price (NZD). Omit for free games. */
  fee?: number;
  /** Split mode: total venue cost shared. Requires totalCost. */
  feeMode?: 'split';
  /** Total cost to split (NZD). Only for feeMode 'split'. */
  totalCost?: number;
  /** Minimum players for split mode. Omit = full capacity. */
  minPlayers?: number;
};

const ACTIVITIES: SeedActivity[] = [
  {
    id: 'seed-act-basketball-1',
    hostKey: 'james',
    title: 'Saturday Afternoon 5v5 Basketball',
    sportType: 'Basketball',
    description:
      'Friendly full-court 5v5 runs at the Domain. Intermediate level, usually 3 matches. Bring a dark and a white top.',
    locationName: 'Auckland Domain Courts',
    address: 'Park Road, Grafton, Auckland',
    latitude: -36.8605,
    longitude: 174.7787,
    startInDays: 1,
    startHour: 16,
    startMinute: 0,
    durationMinutes: 120,
    skillLevel: 'intermediate',
    capacity: 10,
    status: 'open',
    memberKeys: ['alex', 'sarah', 'mike', 'lisa'],
    coverFile: 'covers/basketball_full.png',
    fee: 5,
  },
  {
    id: 'seed-act-tennis-1',
    hostKey: 'sarah',
    joinPolicy: 'approval',
    title: 'Tennis Singles Sunday',
    sportType: 'Tennis',
    description: 'Casual singles, mixed levels welcome. I have spare racquets if you need one.',
    locationName: 'Parnell Tennis Centre',
    address: 'Heather Street, Parnell, Auckland',
    latitude: -36.8523,
    longitude: 174.781,
    startInDays: 4,
    startHour: 10,
    startMinute: 0,
    durationMinutes: 90,
    skillLevel: 'beginner',
    capacity: 4,
    status: 'open',
    memberKeys: ['mike'],
    coverFile: 'covers/tennis_5.png',
  },
  {
    id: 'seed-act-volleyball-1',
    hostKey: 'lisa',
    title: 'Volleyball Co-ed 6v6',
    sportType: 'Volleyball',
    description: 'Indoor co-ed 6v6. One setter spot left — first in, first served.',
    locationName: 'Eventfinda Stadium',
    address: 'Silverfield Lane, Wairau Valley, Auckland',
    latitude: -36.7925,
    longitude: 174.7515,
    startInDays: 5,
    startHour: 19,
    startMinute: 0,
    durationMinutes: 120,
    skillLevel: 'any',
    capacity: 6,
    status: 'full',
    memberKeys: ['alex', 'sarah', 'mike', 'james', 'lisa'],
    coverFile: 'sports/volleyball.png',
    // Indoor court hire split: $60 total, min 4 to run ($15 worst).
    feeMode: 'split',
    totalCost: 60,
    minPlayers: 4,
    fee: 15,
  },
  {
    id: 'seed-act-running-1',
    hostKey: 'mike',
    title: 'Cornwall Park Dawn Patrol 8K',
    sportType: 'Running',
    description:
      'Easy 8km loop around One Tree Hill. Casual pace, no one gets dropped. Coffee after at the cafe.',
    locationName: 'Cornwall Park',
    address: 'Green Lane West, Epsom, Auckland',
    latitude: -36.9007,
    longitude: 174.8245,
    startInDays: 2,
    startHour: 6,
    startMinute: 30,
    durationMinutes: 60,
    skillLevel: 'intermediate',
    capacity: 8,
    status: 'open',
    memberKeys: ['alex'],
  },
  {
    id: 'seed-act-football-1',
    hostKey: 'alex',
    title: 'Friday Night 5-a-side Football',
    sportType: 'Football',
    description: 'Weekly 5-a-side on the turf. Bibs provided, just bring boots (no metal studs).',
    locationName: 'Eden Park Outer Oval',
    address: 'Reimers Avenue, Kingsland, Auckland',
    latitude: -36.875,
    longitude: 174.745,
    startInDays: 3,
    startHour: 18,
    startMinute: 30,
    durationMinutes: 60,
    skillLevel: 'any',
    capacity: 10,
    status: 'open',
    memberKeys: ['james', 'mike'],
  },
  {
    id: 'seed-act-beach-1',
    hostKey: 'james',
    title: 'Mission Bay Beach Volleyball',
    sportType: 'Volleyball',
    description: 'Sunset social 4v4 on the sand. Great turnout — thanks everyone who came!',
    locationName: 'Mission Bay Beach',
    address: 'Tamaki Drive, Mission Bay, Auckland',
    latitude: -36.852,
    longitude: 174.828,
    startInDays: -3,
    startHour: 17,
    startMinute: 0,
    durationMinutes: 120,
    skillLevel: 'any',
    capacity: 8,
    status: 'completed',
    memberKeys: ['alex', 'sarah', 'lisa'],
  },
];

type SeedSwipe = { userKey: string; activityId: string; decision: 'pass' | 'join' };

const SWIPES: SeedSwipe[] = [
  { userKey: 'alex', activityId: 'seed-act-tennis-1', decision: 'join' },
  { userKey: 'alex', activityId: 'seed-act-volleyball-1', decision: 'join' },
  { userKey: 'sarah', activityId: 'seed-act-basketball-1', decision: 'join' },
  { userKey: 'sarah', activityId: 'seed-act-running-1', decision: 'pass' },
  { userKey: 'mike', activityId: 'seed-act-football-1', decision: 'join' },
  { userKey: 'lisa', activityId: 'seed-act-running-1', decision: 'pass' },
];

type SeedChatMessage = {
  id: string;
  activityId: string;
  senderKey: string;
  text: string;
  minutesAgo: number;
};

const CHAT_MESSAGES: SeedChatMessage[] = [
  {
    id: 'seed-msg-1',
    activityId: 'seed-act-basketball-1',
    senderKey: 'james',
    text: 'Hey everyone! Courts are booked for 4pm tomorrow.',
    minutesAgo: 180,
  },
  {
    id: 'seed-msg-2',
    activityId: 'seed-act-basketball-1',
    senderKey: 'alex',
    text: 'Same here! Should we bring extra balls?',
    minutesAgo: 150,
  },
  {
    id: 'seed-msg-3',
    activityId: 'seed-act-basketball-1',
    senderKey: 'sarah',
    text: 'I can bring 2 extra ones.',
    minutesAgo: 145,
  },
  {
    id: 'seed-msg-4',
    activityId: 'seed-act-basketball-1',
    senderKey: 'james',
    text: 'Perfect, see you all at 4pm!',
    minutesAgo: 140,
  },
  {
    id: 'seed-msg-5',
    activityId: 'seed-act-volleyball-1',
    senderKey: 'lisa',
    text: 'We are full! Please arrive 15 minutes early for warmup.',
    minutesAgo: 60,
  },
  {
    id: 'seed-msg-6',
    activityId: 'seed-act-volleyball-1',
    senderKey: 'mike',
    text: 'Got it, see you Thursday.',
    minutesAgo: 45,
  },
];

// Helpers.

const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

function geohashEncode(latitude: number, longitude: number, precision = 7): string {
  let latLow = -90;
  let latHigh = 90;
  let lonLow = -180;
  let lonHigh = 180;
  let buffer = '';
  let bits = 0;
  let bit = 0;
  let even = true;
  while (buffer.length < precision) {
    if (even) {
      const mid = (lonLow + lonHigh) / 2;
      if (longitude >= mid) {
        bits = (bits << 1) | 1;
        lonLow = mid;
      } else {
        bits = bits << 1;
        lonHigh = mid;
      }
    } else {
      const mid = (latLow + latHigh) / 2;
      if (latitude >= mid) {
        bits = (bits << 1) | 1;
        latLow = mid;
      } else {
        bits = bits << 1;
        latHigh = mid;
      }
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      buffer += GEOHASH_ALPHABET[bits & 0x1f];
      bits = 0;
      bit = 0;
    }
  }
  return buffer;
}

function daysAgo(n: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

// Storage.

async function resolveBucket() {
  const candidates = [
    `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    `${env.FIREBASE_PROJECT_ID}.appspot.com`,
  ];
  for (const name of candidates) {
    try {
      const bucket = getStorage().bucket(name);
      const [exists] = await bucket.exists();
      if (exists) return bucket;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    `No Cloud Storage bucket found (tried ${candidates.join(', ')}). ` +
      'Enable Storage in the Firebase console first.',
  );
}

/** Uploads one bundled asset to the deterministic `seed/` Storage path and returns its public URL. */
async function uploadSeedImage(
  bucket: Awaited<ReturnType<typeof resolveBucket>>,
  localRelPath: string,
  destPath: string,
): Promise<string> {
  const data = await readFile(join(MOBILE_ASSETS, localRelPath));
  const file = bucket.file(destPath);
  await file.save(data, {
    contentType: 'image/png',
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  try {
    await file.makePublic();
  } catch {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '2036-01-01',
    });
    return signedUrl;
  }
  return `https://storage.googleapis.com/${bucket.name}/${destPath}`;
}

function startTimeIso(inDays: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + inDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function endTimeIso(inDays: number, hour: number, minute: number, durationMinutes: number): string {
  const d = new Date();
  d.setDate(d.getDate() + inDays);
  d.setHours(hour, minute, 0, 0);
  return new Date(d.getTime() + durationMinutes * 60 * 1000).toISOString();
}

// Reset.

async function resetSeed(uidByKey: Map<string, string>): Promise<void> {
  console.log('Resetting previous seed data...');

  const batch = firestore.batch();
  const activityIds = ACTIVITIES.map((a) => a.id);

  for (const activityId of activityIds) {
    const [participants, requests, ratings] = await Promise.all([
      firestore.collection(`activities/${activityId}/participants`).listDocuments(),
      firestore.collection(`activities/${activityId}/joinRequests`).listDocuments(),
      firestore.collection(`activities/${activityId}/ratings`).listDocuments(),
    ]);
    for (const doc of [...participants, ...requests, ...ratings]) {
      batch.delete(doc);
    }
    batch.delete(firestore.doc(`activities/${activityId}`));
  }

  for (const uid of uidByKey.values()) {
    const [swipes, notifs, devices] = await Promise.all([
      firestore.collection(`swipes/${uid}/decisions`).listDocuments(),
      firestore.collection(`users/${uid}/notifications`).listDocuments(),
      firestore.collection(`users/${uid}/devices`).listDocuments(),
    ]);
    for (const doc of [...swipes, ...notifs, ...devices]) batch.delete(doc);
    batch.delete(firestore.doc(`users/${uid}`));
  }

  for (const user of USERS) {
    batch.delete(firestore.doc(`userEmails/${user.email.toLowerCase()}`));
  }

  await batch.commit();

  const rtdbUpdates: Record<string, null> = {};
  for (const activityId of activityIds) {
    rtdbUpdates[`activityChats/${activityId}`] = null;
    rtdbUpdates[`typing/${activityId}`] = null;
  }
  for (const uid of uidByKey.values()) {
    rtdbUpdates[`presence/${uid}`] = null;
  }
  await rtdb.ref().update(rtdbUpdates);

  for (const user of USERS) {
    try {
      const existing = await auth.getUserByEmail(user.email);
      await auth.deleteUser(existing.uid);
      console.log(`  deleted auth user ${user.email}`);
    } catch {
      // Not found — nothing to delete.
    }
  }

  try {
    const bucket = await resolveBucket();
    const [files] = await bucket.getFiles({ prefix: 'seed/' });
    await Promise.all(files.map((file) => file.delete()));
    console.log(`  deleted ${files.length} Storage object(s) under seed/`);
  } catch (error) {
    console.log(`  Storage reset skipped: ${(error as Error).message}`);
  }

  console.log('Reset complete.');
}

async function collectSeedUids(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    USERS.map(async (user) => {
      try {
        const existing = await auth.getUserByEmail(user.email);
        map.set(user.key, existing.uid);
      } catch {
        // Not seeded yet.
      }
    }),
  );
  return map;
}

// Seed.

async function main(): Promise<void> {
  const shouldReset = process.argv.includes('--reset');

  if (shouldReset) {
    await resetSeed(await collectSeedUids());
  }

  // 1. Auth users (create or reuse by email).
  const uidByKey = new Map<string, string>();
  for (const user of USERS) {
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(user.email);
      uid = existing.uid;
      console.log(`Auth user exists: ${user.email} (${uid})`);
    } catch {
      const created = await auth.createUser({
        email: user.email,
        password: DEMO_PASSWORD,
        displayName: user.displayName,
        emailVerified: true,
      });
      uid = created.uid;
      console.log(`Auth user created: ${user.email} (${uid})`);
    }
    uidByKey.set(user.key, uid);
  }

  // 1b.
  const bucket = await resolveBucket();
  const photoUrlByKey = new Map<string, string>();
  await Promise.all(
    USERS.map(async (user) => {
      const url = await uploadSeedImage(bucket, user.avatarFile, `seed/avatars/${user.key}.png`);
      photoUrlByKey.set(user.key, url);
    }),
  );
  const coverUrlByActivity = new Map<string, string>();
  await Promise.all(
    ACTIVITIES.filter((a) => a.coverFile).map(async (activity) => {
      const url = await uploadSeedImage(
        bucket,
        activity.coverFile!,
        `seed/covers/${activity.id}.png`,
      );
      coverUrlByActivity.set(activity.id, url);
    }),
  );
  console.log(
    `Storage seeded: ${photoUrlByKey.size} avatars, ` +
      `${coverUrlByActivity.size} covers at gs://${bucket.name}/seed/.`,
  );

  const batch = firestore.batch();

  // 2. User profiles + email index.
  for (const user of USERS) {
    const uid = uidByKey.get(user.key)!;
    batch.set(
      firestore.doc(`users/${uid}`),
      {
        authUid: uid,
        email: user.email.toLowerCase(),
        displayName: user.displayName,
        bio: user.bio,
        skillLevel: user.skillLevel,
        preferredSports: user.preferredSports,
        preferredLocations: user.preferredLocations,
        profileCompleted: true,
        photoUrl: photoUrlByKey.get(user.key)!,
        createdAt: daysAgo(30),
        updatedAt: daysAgo(1),
      },
      { merge: true },
    );
    batch.set(firestore.doc(`userEmails/${user.email.toLowerCase()}`), { authUid: uid });
  }

  // 3. Activities + participants.
  for (const activity of ACTIVITIES) {
    const hostUid = uidByKey.get(activity.hostKey)!;
    const participantCount = activity.memberKeys.length;
    const status: SeedActivity['status'] =
      activity.status === 'completed'
        ? 'completed'
        : participantCount >= activity.capacity
          ? 'full'
          : 'open';

    const coverImageUrl = coverUrlByActivity.get(activity.id);
    batch.set(firestore.doc(`activities/${activity.id}`), {
      hostId: hostUid,
      title: activity.title,
      sportType: activity.sportType,
      description: activity.description,
      locationName: activity.locationName,
      address: activity.address,
      latitude: activity.latitude,
      longitude: activity.longitude,
      geohash: geohashEncode(activity.latitude, activity.longitude),
      startTime: startTimeIso(activity.startInDays, activity.startHour, activity.startMinute),
      endTime: endTimeIso(
        activity.startInDays,
        activity.startHour,
        activity.startMinute,
        activity.durationMinutes,
      ),
      skillLevel: activity.skillLevel,
      capacity: activity.capacity,
      participantCount,
      status,
      ...(coverImageUrl ? { coverImageUrl } : {}),
      ...(activity.joinPolicy ? { joinPolicy: activity.joinPolicy } : {}),
      // Pricing: free by default; fixed `fee` or split (`feeMode` + `totalCost` + worst-case `fee`) when set.
      ...((activity.fee ?? 0) > 0 || activity.feeMode === 'split'
        ? { isPaid: true }
        : { isPaid: false }),
      ...((activity.fee ?? 0) > 0 ? { fee: activity.fee! } : {}),
      ...(activity.feeMode === 'split'
        ? {
            feeMode: 'split' as const,
            totalCost: activity.totalCost!,
            ...(activity.minPlayers !== undefined ? { minPlayers: activity.minPlayers } : {}),
          }
        : {}),
      createdAt: daysAgo(7),
      updatedAt: daysAgo(1),
    });

    activity.memberKeys.forEach((memberKey, index) => {
      const memberUid = uidByKey.get(memberKey)!;
      batch.set(firestore.doc(`activities/${activity.id}/participants/${memberUid}`), {
        uid: memberUid,
        joinedAt: daysAgo(6 - Math.min(index, 5)),
      });
    });

    // Alex has a pending request on the approval-gated tennis session (he is deliberately NOT a participant there).
    if (activity.id === 'seed-act-tennis-1') {
      const requesterUid = uidByKey.get('alex')!;
      batch.set(firestore.doc(`activities/${activity.id}/joinRequests/${requesterUid}`), {
        uid: requesterUid,
        activityId: activity.id,
        status: 'pending',
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      });
    }
  }

  // 4. Swipe decisions.
  SWIPES.forEach((swipe, index) => {
    const uid = uidByKey.get(swipe.userKey)!;
    batch.set(firestore.doc(`swipes/${uid}/decisions/${swipe.activityId}`), {
      uid,
      activityId: swipe.activityId,
      decision: swipe.decision,
      createdAt: daysAgo(5 - Math.min(index, 4)),
      updatedAt: daysAgo(5 - Math.min(index, 4)),
    });
  });

  // 5. Notifications.
  const jamesUid = uidByKey.get('james')!;
  const sarahUid = uidByKey.get('sarah')!;
  const alexUid = uidByKey.get('alex')!;
  const mikeUid = uidByKey.get('mike')!;
  const seedNotifications: Array<{
    id: string;
    recipientUid: string;
    type: string;
    title: string;
    body: string;
    activityId?: string;
    senderUid?: string;
    isRead: boolean;
    ageInDays: number;
  }> = [
    {
      id: 'seed-notif-1',
      recipientUid: jamesUid,
      type: 'activity_joined',
      title: 'New participant',
      body: 'Alex Mercer joined Saturday Afternoon 5v5 Basketball',
      activityId: 'seed-act-basketball-1',
      senderUid: alexUid,
      isRead: false,
      ageInDays: 2,
    },
    {
      id: 'seed-notif-2',
      recipientUid: jamesUid,
      type: 'activity_interest',
      title: 'New activity interest',
      body: 'Sarah Chen is interested in Saturday Afternoon 5v5 Basketball',
      activityId: 'seed-act-basketball-1',
      senderUid: sarahUid,
      isRead: false,
      ageInDays: 1,
    },
    {
      id: 'seed-notif-3',
      recipientUid: sarahUid,
      type: 'activity_joined',
      title: 'New participant',
      body: 'Mike Chen joined Tennis Singles Sunday',
      activityId: 'seed-act-tennis-1',
      senderUid: mikeUid,
      isRead: true,
      ageInDays: 3,
    },
    {
      id: 'seed-notif-4',
      recipientUid: alexUid,
      type: 'system',
      title: 'Welcome to MatchUp!',
      body: 'Complete your profile to get matched with players near you.',
      isRead: false,
      ageInDays: 6,
    },
    {
      id: 'seed-notif-5',
      recipientUid: mikeUid,
      type: 'chat_message',
      title: 'New message in Cornwall Park Dawn Patrol 8K',
      body: 'Alex Mercer: See you at 6:30!',
      activityId: 'seed-act-running-1',
      senderUid: alexUid,
      isRead: false,
      ageInDays: 0,
    },
    {
      id: 'seed-notif-6',
      recipientUid: sarahUid,
      type: 'join_request',
      title: 'New join request',
      body: 'Alex Mercer requested to join Tennis Singles Sunday',
      activityId: 'seed-act-tennis-1',
      senderUid: alexUid,
      isRead: false,
      ageInDays: 1,
    },
  ];
  for (const notif of seedNotifications) {
    batch.set(firestore.doc(`users/${notif.recipientUid}/notifications/${notif.id}`), {
      recipientUid: notif.recipientUid,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      isRead: notif.isRead,
      createdAt: daysAgo(notif.ageInDays),
      ...(notif.activityId ? { activityId: notif.activityId } : {}),
      ...(notif.senderUid ? { senderUid: notif.senderUid } : {}),
    });
  }

  await batch.commit();
  console.log(
    `Firestore seeded: ${USERS.length} users, ${ACTIVITIES.length} activities, ` +
      `${SWIPES.length} swipes, ${seedNotifications.length} notifications.`,
  );

  // 6. RTDB: chat messages, presence, typing.
  const rtdbUpdates: Record<string, unknown> = {};
  for (const msg of CHAT_MESSAGES) {
    rtdbUpdates[`activityChats/${msg.activityId}/messages/${msg.id}`] = {
      senderId: uidByKey.get(msg.senderKey)!,
      text: msg.text,
      type: 'text',
      timestamp: Date.now() - msg.minutesAgo * 60 * 1000,
    };
  }
  const presenceStates: Record<string, 'online' | 'offline'> = {
    alex: 'online',
    sarah: 'online',
    mike: 'online',
    lisa: 'offline',
    james: 'offline',
  };
  for (const [key, state] of Object.entries(presenceStates)) {
    rtdbUpdates[`presence/${uidByKey.get(key)!}`] = {
      state,
      lastChanged: Date.now() - 5 * 60 * 1000,
    };
  }
  rtdbUpdates[`typing/seed-act-basketball-1/${sarahUid}`] = {
    isTyping: true,
    updatedAt: Date.now(),
  };

  await rtdb.ref().update(rtdbUpdates);
  console.log(
    `RTDB seeded: ${CHAT_MESSAGES.length} chat messages, ` +
      `${Object.keys(presenceStates).length} presence rows, 1 typing row.`,
  );

  // Ratings on the completed beach activity, submitted through the real service so aggregates stay consistent.
  const { submitActivityRating } = await import('../modules/ratings/ratings.service.js');
  const beachRatings: Array<{ rater: string; ratings: Array<{ ratee: string; stars: number }> }> = [
    {
      rater: 'alex',
      ratings: [
        { ratee: 'sarah', stars: 5 },
        { ratee: 'lisa', stars: 4 },
      ],
    },
    {
      rater: 'sarah',
      ratings: [
        { ratee: 'alex', stars: 5 },
        { ratee: 'lisa', stars: 5 },
      ],
    },
    {
      rater: 'lisa',
      ratings: [
        { ratee: 'alex', stars: 4 },
        { ratee: 'sarah', stars: 5 },
      ],
    },
    { rater: 'james', ratings: [{ ratee: 'alex', stars: 5 }] },
  ];
  for (const entry of beachRatings) {
    await submitActivityRating({
      activityId: 'seed-act-beach-1',
      raterUid: uidByKey.get(entry.rater)!,
      sportType: 'Volleyball',
      participantRatings: entry.ratings.map((r) => ({
        rateeUid: uidByKey.get(r.ratee)!,
        stars: r.stars,
      })),
    });
  }
  console.log(`Ratings seeded: ${beachRatings.length} submissions on seed-act-beach-1.`);

  // 7b. Deterministic doc ids make re-runs overwrite instead of duplicating.
  const SEED_SPORTS: Array<{
    id: string;
    name: string;
    emoji: string;
    enabled: boolean;
    showInFilter: boolean;
    showInOnboarding: boolean;
    canHost: boolean;
    sortOrder: number;
  }> = [
    {
      id: 'basketball',
      name: 'Basketball',
      emoji: '🏀',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 1,
    },
    {
      id: 'football',
      name: 'Soccer',
      emoji: '⚽',
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
      id: 'running',
      name: 'Running',
      emoji: '🏃',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 4,
    },
    {
      id: 'badminton',
      name: 'Badminton',
      emoji: '🏸',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 5,
    },
    {
      id: 'volleyball',
      name: 'Volleyball',
      emoji: '🏐',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 6,
    },
    {
      id: 'cycling',
      name: 'Cycling',
      emoji: '🚴',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 7,
    },
    {
      id: 'swimming',
      name: 'Swimming',
      emoji: '🏊',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 8,
    },
    {
      id: 'fitness',
      name: 'Fitness',
      emoji: '💪',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 9,
    },
    {
      id: 'golf',
      name: 'Golf',
      emoji: '⛳',
      enabled: true,
      showInFilter: true,
      showInOnboarding: true,
      canHost: false,
      sortOrder: 10,
    },
    {
      id: 'squash',
      name: 'Squash',
      emoji: '🎱',
      enabled: true,
      showInFilter: false,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 11,
    },
    {
      id: 'yoga',
      name: 'Yoga',
      emoji: '🧘',
      enabled: true,
      showInFilter: false,
      showInOnboarding: true,
      canHost: false,
      sortOrder: 12,
    },
    {
      id: 'futsal',
      name: 'Futsal',
      emoji: '🥅',
      enabled: true,
      showInFilter: false,
      showInOnboarding: false,
      canHost: true,
      sortOrder: 13,
    },
    {
      id: 'cricket',
      name: 'Cricket',
      emoji: '🏏',
      enabled: false,
      showInFilter: false,
      showInOnboarding: false,
      canHost: false,
      sortOrder: 14,
    },
    {
      id: 'tabletennis',
      name: 'Table Tennis',
      emoji: '🏓',
      enabled: false,
      showInFilter: false,
      showInOnboarding: false,
      canHost: false,
      sortOrder: 15,
    },
  ];
  for (const sport of SEED_SPORTS) {
    await firestore.doc(`sports/${sport.id}`).set(
      {
        ...sport,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  }

  const SEED_TEMPLATES: Array<{
    trigger: string;
    category: string;
    name: string;
    description: string;
    title: string;
    body: string;
    variables: string[];
    enabled: boolean;
  }> = [
    {
      trigger: 'activity.joined',
      category: 'Activity',
      name: 'Activity Joined',
      description: 'Sent to the host when a new participant joins their activity',
      title: '{{participantName}} joined your activity!',
      body: 'Great news — {{participantName}} has joined "{{activityName}}". You now have {{participantCount}}/{{capacity}} spots filled.',
      variables: ['participantName', 'activityName', 'participantCount', 'capacity'],
      enabled: true,
    },
    {
      trigger: 'activity.cancelled',
      category: 'Activity',
      name: 'Activity Cancelled',
      description: 'Sent to all participants when a host cancels an activity',
      title: '"{{activityName}}" has been cancelled',
      body: 'Unfortunately, "{{activityName}}" scheduled for {{activityDate}} has been cancelled by the host.',
      variables: ['activityName', 'activityDate', 'hostName'],
      enabled: true,
    },
    {
      trigger: 'activity.reminder',
      category: 'Activity',
      name: 'Activity Reminder (24h)',
      description: 'Reminder sent 24 hours before activity starts',
      title: 'Reminder: {{activityName}} is tomorrow!',
      body: 'Just a reminder that "{{activityName}}" starts tomorrow at {{activityTime}} at {{location}}. See you there!',
      variables: ['activityName', 'activityTime', 'location', 'hostName'],
      enabled: true,
    },
    {
      trigger: 'activity.full',
      category: 'Activity',
      name: 'Activity Now Full',
      description: 'Sent to host when their activity reaches capacity',
      title: 'Your activity is full!',
      body: '"{{activityName}}" has reached its capacity of {{capacity}} participants.',
      variables: ['activityName', 'capacity'],
      enabled: true,
    },
    {
      trigger: 'activity.starting_soon',
      category: 'Activity',
      name: 'Activity Starting Soon (1h)',
      description: 'Sent to participants 1 hour before activity starts',
      title: '{{activityName}} starts in 1 hour',
      body: 'Head over to {{location}} — "{{activityName}}" starts in about 1 hour.',
      variables: ['activityName', 'location', 'activityTime'],
      enabled: false,
    },
    {
      trigger: 'account.suspended',
      category: 'Account',
      name: 'Account Suspended',
      description: 'Sent to user when their account is suspended by admin',
      title: 'Your MatchUp account has been suspended',
      body: 'Your account has been suspended due to a violation of our community guidelines: {{reason}}.',
      variables: ['reason', 'supportEmail', 'appealDeadline'],
      enabled: true,
    },
    {
      trigger: 'account.reactivated',
      category: 'Account',
      name: 'Account Reactivated',
      description: 'Sent when a suspended account is reinstated',
      title: 'Your account has been reinstated',
      body: 'Good news — your MatchUp account has been reactivated. Welcome back!',
      variables: [],
      enabled: true,
    },
    {
      trigger: 'account.welcome',
      category: 'Account',
      name: 'Welcome Message',
      description: 'First notification sent after account creation',
      title: 'Welcome to MatchUp, {{userName}}!',
      body: "You're all set! Start by browsing activities near you or create your own.",
      variables: ['userName'],
      enabled: true,
    },
    {
      trigger: 'moderation.report_resolved',
      category: 'Moderation',
      name: 'Report Resolved (to reporter)',
      description: 'Sent to the user who filed a report when it is resolved',
      title: 'Your report has been reviewed',
      body: 'Thank you for helping keep MatchUp safe. Your report has been reviewed and action has been taken.',
      variables: [],
      enabled: true,
    },
    {
      trigger: 'moderation.appeal_approved',
      category: 'Moderation',
      name: 'Appeal Approved',
      description: "Sent when an admin approves a user's appeal",
      title: 'Your appeal has been approved',
      body: 'We have reviewed your appeal and decided to reverse the previous action on your account. {{adminNote}}',
      variables: ['adminNote'],
      enabled: true,
    },
    {
      trigger: 'moderation.appeal_rejected',
      category: 'Moderation',
      name: 'Appeal Rejected',
      description: "Sent when an admin rejects a user's appeal",
      title: 'Your appeal has been reviewed',
      body: 'After careful review, we were unable to approve your appeal. {{adminNote}}',
      variables: ['adminNote', 'supportEmail'],
      enabled: true,
    },
    {
      trigger: 'engagement.inactive',
      category: 'Engagement',
      name: 'Re-engagement (Inactive User)',
      description: "Sent to users who haven't opened the app in 30+ days",
      title: 'We miss you on MatchUp!',
      body: 'There are {{nearbyCount}} activities happening near you this week — come back and play!',
      variables: ['nearbyCount', 'userName'],
      enabled: false,
    },
    {
      trigger: 'engagement.new_activity_nearby',
      category: 'Engagement',
      name: 'New Activity Nearby',
      description: "Sent when a new activity matches user's preferred sports",
      title: 'New {{sport}} activity near you',
      body: '"{{activityName}}" is happening {{distanceKm}}km from you on {{activityDate}}. Only {{spotsLeft}} spots left — join now!',
      variables: ['sport', 'activityName', 'distanceKm', 'activityDate', 'spotsLeft'],
      enabled: true,
    },
  ];
  for (const template of SEED_TEMPLATES) {
    await firestore.doc(`notificationTemplates/${template.trigger}`).set(
      {
        ...template,
        lastEditedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  }
  console.log(
    `Admin config seeded: ${SEED_SPORTS.length} sports, ${SEED_TEMPLATES.length} notification templates.`,
  );

  // 8. Verify by reading back through the same paths the API uses.
  const [usersSnap, activitiesSnap] = await Promise.all([
    firestore.collection('users').get(),
    firestore.collection('activities').get(),
  ]);
  const participantsSnap = await firestore
    .collection('activities/seed-act-basketball-1/participants')
    .get();
  const chatSnap = await rtdb.ref('activityChats/seed-act-basketball-1/messages').get();
  const alexDoc = await firestore.doc(`users/${uidByKey.get('alex')}`).get();
  const alexRatings = alexDoc.data()?.ratingBySport as
    Record<string, { average: number; count: number }> | undefined;
  console.log(
    `Verify: users=${usersSnap.size}, activities=${activitiesSnap.size}, ` +
      `basketball-1 participants=${participantsSnap.size}, ` +
      `basketball-1 messages=${chatSnap.numChildren()}, ` +
      `alex Volleyball rating=${JSON.stringify(alexRatings?.Volleyball)}.`,
  );

  console.log('\nDemo logins (password for all):');
  for (const user of USERS) {
    console.log(`  ${user.email}  /  ${DEMO_PASSWORD}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
