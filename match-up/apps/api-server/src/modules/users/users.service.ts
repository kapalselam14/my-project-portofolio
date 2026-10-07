import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { auth, firestore } from '../../database/firebase.js';

export type BootstrapUserInput = {
  authUid: string;
  email: string;
};

export type BootstrapUserResult = {
  authUid: string;
  email: string;
  created: boolean;
};

export type SportRatingAggregate = {
  average: number;
  count: number;
};

export type UserRecord = {
  authUid: string;
  email: string;
  createdAt: FirebaseFirestore.Timestamp;
  /** Computed on read (never stored): participations and hosted activities. */
  activitiesCount?: number;
  hostedCount?: number;
  updatedAt?: FirebaseFirestore.Timestamp;
  displayName?: string;
  photoPath?: string;
  photoUrl?: string;
  bio?: string;
  gender?: string;
  dateOfBirth?: string;
  /** Height in centimetres. Optional; shown publicly on the profile. */
  heightCm?: number;
  /** Weight in kilograms. Optional; private (own profile only). */
  weightKg?: number;
  /** Free-text primary goal. Optional; private (own profile only). */
  goal?: string;
  skillLevel?: SkillLevel;
  preferredSports?: string[];
  /** Per-sport skill levels, e.g. `{ Tennis: 'intermediate' }`. */
  sportSkillLevels?: Record<string, SkillLevel>;
  preferredLocations?: string[];
  profileCompleted?: boolean;
  /** Onboarding answer: why the user joined MatchUp. Private. */
  joinReason?: string;
  ratingBySport?: Record<string, SportRatingAggregate>;
  totalRatingCount?: number;
  /** Host-role aggregates (ratings received while hosting). Absent on old docs. */
  hostRatingBySport?: Record<string, SportRatingAggregate>;
  totalHostRatingCount?: number;
  /** Admin-managed suspension state. Absent on old docs = 'active'. */
  status?: UserStatus;
};

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'any';

/** Admin-managed account state. Absent on old docs = 'active'. */
export type UserStatus = 'active' | 'suspended';

export function isUserStatus(value: unknown): value is UserStatus {
  return value === 'active' || value === 'suspended';
}

export type UpdateUserProfileInput = {
  displayName?: string;
  bio?: string;
  gender?: string;
  dateOfBirth?: string;
  /** Height in centimetres (integer 50–300). */
  heightCm?: number;
  /** Weight in kilograms (integer 30–300). */
  weightKg?: number;
  /** Free-text primary goal. */
  goal?: string;
  skillLevel?: SkillLevel;
  preferredSports?: string[];
  sportSkillLevels?: Record<string, SkillLevel>;
  preferredLocations?: string[];
  joinReason?: string;
};

export type PublicUserProfile = {
  authUid: string;
  activitiesCount?: number;
  hostedCount?: number;
  displayName?: string;
  photoUrl?: string;
  bio?: string;
  /** ISO date of birth — clients render age, never the raw date. */
  dateOfBirth?: string;
  /** Height in centimetres. */
  heightCm?: number;
  skillLevel?: SkillLevel;
  preferredSports?: string[];
  sportSkillLevels?: Record<string, SkillLevel>;
  preferredLocations?: string[];
  profileCompleted?: boolean;
  ratingBySport?: Record<string, SportRatingAggregate>;
  totalRatingCount?: number;
  /** Host-role aggregates (ratings received while hosting). Absent on old docs. */
  hostRatingBySport?: Record<string, SportRatingAggregate>;
  totalHostRatingCount?: number;
};

export type UpdateUserPhotoInput = {
  photoPath: string;
  photoUrl: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isSkillLevel(value: unknown): value is SkillLevel {
  return (
    value === 'beginner' || value === 'intermediate' || value === 'advanced' || value === 'any'
  );
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`Invalid user record: ${fieldName} must be a string array`);
  }

  return value;
}

function assertSportSkillLevels(value: unknown): Record<string, SkillLevel> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid user record: sportSkillLevels must be an object');
  }

  const result: Record<string, SkillLevel> = {};

  for (const [sport, level] of Object.entries(value as Record<string, unknown>)) {
    if (!sport.trim()) {
      throw new Error('Invalid user record: sportSkillLevels keys must be non-empty strings');
    }
    if (!isSkillLevel(level)) {
      throw new Error(
        `Invalid user record: sportSkillLevels.${sport} must be beginner, intermediate, advanced, or any`,
      );
    }
    result[sport] = level;
  }

  return result;
}

function assertRatingBySport(value: unknown): Record<string, SportRatingAggregate> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid user record: ratingBySport must be an object');
  }

  const result: Record<string, SportRatingAggregate> = {};

  for (const [sport, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`Invalid user record: ratingBySport.${sport} must be an object`);
    }

    const { average, count } = entry as Record<string, unknown>;

    if (typeof average !== 'number' || typeof count !== 'number') {
      throw new Error(
        `Invalid user record: ratingBySport.${sport} must have numeric average and count`,
      );
    }

    result[sport] = { average, count };
  }

  return result;
}

function mapUserDoc(userDoc: FirebaseFirestore.DocumentSnapshot): UserRecord | null {
  // Treat Firestore as untrusted input and project only fields with supported stored shapes.
  if (!userDoc.exists) {
    return null;
  }

  const data = userDoc.data();

  if (!data) {
    return null;
  }

  if (typeof data.email !== 'string') {
    throw new Error('Invalid user record: email must be a string');
  }

  if (!data.createdAt || typeof data.createdAt !== 'object' || !('toDate' in data.createdAt)) {
    throw new Error('Invalid user record: createdAt must be a Firestore Timestamp');
  }

  if (
    data.updatedAt !== undefined &&
    (!data.updatedAt || typeof data.updatedAt !== 'object' || !('toDate' in data.updatedAt))
  ) {
    throw new Error('Invalid user record: updatedAt must be a Firestore Timestamp');
  }

  if (data.skillLevel !== undefined && !isSkillLevel(data.skillLevel)) {
    throw new Error(
      'Invalid user record: skillLevel must be beginner, intermediate, advanced, or any',
    );
  }

  if (data.profileCompleted !== undefined && typeof data.profileCompleted !== 'boolean') {
    throw new Error('Invalid user record: profileCompleted must be a boolean');
  }

  return {
    authUid: userDoc.id,
    email: data.email,
    createdAt: data.createdAt as FirebaseFirestore.Timestamp,
    ...(data.updatedAt !== undefined
      ? { updatedAt: data.updatedAt as FirebaseFirestore.Timestamp }
      : {}),
    ...(typeof data.displayName === 'string' ? { displayName: data.displayName } : {}),
    ...(typeof data.photoPath === 'string' ? { photoPath: data.photoPath } : {}),
    ...(typeof data.photoUrl === 'string' ? { photoUrl: data.photoUrl } : {}),
    ...(typeof data.bio === 'string' ? { bio: data.bio } : {}),
    ...(typeof data.gender === 'string' ? { gender: data.gender } : {}),
    ...(typeof data.dateOfBirth === 'string' ? { dateOfBirth: data.dateOfBirth } : {}),
    ...(Number.isInteger(data.heightCm) ? { heightCm: data.heightCm as number } : {}),
    ...(Number.isInteger(data.weightKg) ? { weightKg: data.weightKg as number } : {}),
    ...(typeof data.goal === 'string' ? { goal: data.goal } : {}),
    ...(isSkillLevel(data.skillLevel) ? { skillLevel: data.skillLevel } : {}),
    ...(data.preferredSports !== undefined
      ? { preferredSports: assertStringArray(data.preferredSports, 'preferredSports') }
      : {}),
    ...(data.sportSkillLevels !== undefined
      ? { sportSkillLevels: assertSportSkillLevels(data.sportSkillLevels) }
      : {}),
    ...(data.preferredLocations !== undefined
      ? { preferredLocations: assertStringArray(data.preferredLocations, 'preferredLocations') }
      : {}),
    ...(typeof data.joinReason === 'string' ? { joinReason: data.joinReason } : {}),
    ...(typeof data.profileCompleted === 'boolean'
      ? { profileCompleted: data.profileCompleted }
      : {}),
    ...(data.ratingBySport !== undefined
      ? { ratingBySport: assertRatingBySport(data.ratingBySport) }
      : {}),
    ...(typeof data.totalRatingCount === 'number'
      ? { totalRatingCount: data.totalRatingCount }
      : {}),
    ...(data.hostRatingBySport !== undefined
      ? { hostRatingBySport: assertRatingBySport(data.hostRatingBySport) }
      : {}),
    ...(typeof data.totalHostRatingCount === 'number'
      ? { totalHostRatingCount: data.totalHostRatingCount }
      : {}),
    ...(isUserStatus(data.status) ? { status: data.status } : {}),
  };
}

function toPublicUserProfile(user: UserRecord): PublicUserProfile {
  // Keep private account and onboarding fields out of profiles returned to other users.
  return {
    authUid: user.authUid,
    ...(user.activitiesCount !== undefined ? { activitiesCount: user.activitiesCount } : {}),
    ...(user.hostedCount !== undefined ? { hostedCount: user.hostedCount } : {}),
    ...(user.displayName !== undefined ? { displayName: user.displayName } : {}),
    ...(user.photoUrl !== undefined ? { photoUrl: user.photoUrl } : {}),
    ...(user.bio !== undefined ? { bio: user.bio } : {}),
    ...(user.dateOfBirth !== undefined ? { dateOfBirth: user.dateOfBirth } : {}),
    ...(user.heightCm !== undefined ? { heightCm: user.heightCm } : {}),
    ...(user.skillLevel !== undefined ? { skillLevel: user.skillLevel } : {}),
    ...(user.preferredSports !== undefined ? { preferredSports: user.preferredSports } : {}),
    ...(user.sportSkillLevels !== undefined ? { sportSkillLevels: user.sportSkillLevels } : {}),
    ...(user.preferredLocations !== undefined
      ? { preferredLocations: user.preferredLocations }
      : {}),
    ...(user.profileCompleted !== undefined ? { profileCompleted: user.profileCompleted } : {}),
    ...(user.ratingBySport !== undefined ? { ratingBySport: user.ratingBySport } : {}),
    ...(user.totalRatingCount !== undefined ? { totalRatingCount: user.totalRatingCount } : {}),
    ...(user.hostRatingBySport !== undefined ? { hostRatingBySport: user.hostRatingBySport } : {}),
    ...(user.totalHostRatingCount !== undefined
      ? { totalHostRatingCount: user.totalHostRatingCount }
      : {}),
  };
}

function isProfileCompleted(profile: UserRecord | UpdateUserProfileInput): boolean {
  return Boolean(
    profile.displayName?.trim() &&
    profile.skillLevel &&
    profile.preferredSports &&
    profile.preferredSports.length > 0,
  );
}

export async function bootstrapUser(input: BootstrapUserInput): Promise<BootstrapUserResult> {
  const authUid = input.authUid.trim();
  const normalizedEmail = normalizeEmail(input.email);

  if (!authUid) {
    throw new Error('authUid is required');
  }

  if (!normalizedEmail) {
    throw new Error('email is required');
  }

  const userRef = firestore.collection('users').doc(authUid);
  const emailRef = firestore.collection('userEmails').doc(normalizedEmail);

  // Reserve the normalized email and create the user together to prevent duplicate accounts.
  return firestore.runTransaction(async (transaction) => {
    const [userDoc, emailDoc] = await Promise.all([
      transaction.get(userRef),
      transaction.get(emailRef),
    ]);

    if (userDoc.exists) {
      const data = userDoc.data();

      if (!data || typeof data.email !== 'string') {
        throw new Error('Invalid user record: email must be a string');
      }

      return {
        authUid: userDoc.id,
        email: data.email,
        created: false,
      };
    }

    if (emailDoc.exists) {
      throw new Error('Email already in use');
    }

    transaction.set(userRef, {
      authUid,
      email: normalizedEmail,
      createdAt: FieldValue.serverTimestamp(),
    });

    transaction.set(emailRef, {
      authUid,
    });

    return {
      authUid,
      email: normalizedEmail,
      created: true,
    };
  });
}

export async function mintCustomToken(authUid: string): Promise<string> {
  const normalizedAuthUid = authUid.trim();

  if (!normalizedAuthUid) {
    throw new Error('authUid is required');
  }

  return auth.createCustomToken(normalizedAuthUid);
}

export async function getUserByAuthUid(authUid: string): Promise<UserRecord | null> {
  const normalizedAuthUid = authUid.trim();

  if (!normalizedAuthUid) {
    throw new Error('authUid is required');
  }

  const userDoc = await firestore.collection('users').doc(normalizedAuthUid).get();
  const user = mapUserDoc(userDoc);

  if (!user) {
    return null;
  }

  const counts = await countUserActivities(normalizedAuthUid);

  return {
    ...user,
    ...counts,
  };
}

/** Count joined and hosted activities; on read failure, return zero counts so profile reads still work. */
export async function countUserActivities(
  authUid: string,
): Promise<{ activitiesCount: number; hostedCount: number }> {
  const zero = { activitiesCount: 0, hostedCount: 0 };

  try {
    const [joinedSnap, hostedSnap] = await Promise.all([
      firestore.collectionGroup('participants').where('uid', '==', authUid).count().get(),
      firestore.collection('activities').where('hostId', '==', authUid).count().get(),
    ]);

    return {
      activitiesCount: joinedSnap.data().count,
      hostedCount: hostedSnap.data().count,
    };
  } catch {
    return zero;
  }
}

export async function updateUserProfile(
  authUid: string,
  input: UpdateUserProfileInput,
): Promise<UserRecord> {
  const normalizedAuthUid = authUid.trim();

  if (!normalizedAuthUid) {
    throw new Error('authUid is required');
  }

  if (Object.keys(input).length === 0) {
    throw new Error('At least one profile field is required');
  }

  const userRef = firestore.collection('users').doc(normalizedAuthUid);
  const updatedAt = Timestamp.now();

  // Recompute completion from the merged profile so partial edits preserve existing answers.
  return firestore.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const existingUser = mapUserDoc(userDoc);

    if (!existingUser) {
      throw new Error('User not found');
    }

    const mergedUser = {
      ...existingUser,
      ...input,
    };

    const updateData = {
      ...input,
      profileCompleted: isProfileCompleted(mergedUser),
      updatedAt,
    };

    transaction.update(userRef, updateData);

    return {
      ...mergedUser,
      profileCompleted: updateData.profileCompleted,
      updatedAt,
    };
  });
}

export async function getPublicUserProfile(authUid: string): Promise<PublicUserProfile | null> {
  const user = await getUserByAuthUid(authUid);

  if (user) {
    return toPublicUserProfile(user);
  }

  // Fallback: mobile profile routes navigate by display name (`/player-profile/:name`).
  const byName = await getUserByDisplayName(authUid);
  if (!byName) {
    return null;
  }

  return toPublicUserProfile(byName);
}

/** Exact-match lookup by display name. Used only as a fallback when a uid lookup misses (see above). */
export async function getUserByDisplayName(displayName: string): Promise<UserRecord | null> {
  const normalized = displayName.trim();
  if (!normalized) {
    throw new Error('displayName is required');
  }

  const snap = await firestore
    .collection('users')
    .where('displayName', '==', normalized)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  // Adapt the query result to the shared mapper; user documents are keyed by auth uid.
  const firstDoc = snap.docs[0];
  if (!firstDoc) {
    return null;
  }
  const user = mapUserDoc(firstDoc);

  if (!user) {
    return null;
  }

  const counts = await countUserActivities(user.authUid);
  return { ...user, ...counts };
}

export async function updateUserPhoto(
  authUid: string,
  input: UpdateUserPhotoInput,
): Promise<UserRecord> {
  const normalizedAuthUid = authUid.trim();
  const photoPath = input.photoPath.trim();
  const photoUrl = input.photoUrl.trim();

  if (!normalizedAuthUid) {
    throw new Error('authUid is required');
  }

  if (!photoPath) {
    throw new Error('photoPath is required');
  }

  if (!photoUrl) {
    throw new Error('photoUrl is required');
  }

  if (!photoPath.startsWith(`users/${normalizedAuthUid}/profile/`)) {
    throw new Error('photoPath must belong to the authenticated user');
  }

  const userRef = firestore.collection('users').doc(normalizedAuthUid);
  const updatedAt = Timestamp.now();

  return firestore.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const existingUser = mapUserDoc(userDoc);

    if (!existingUser) {
      throw new Error('User not found');
    }

    transaction.update(userRef, {
      photoPath,
      photoUrl,
      updatedAt,
    });

    return {
      ...existingUser,
      photoPath,
      photoUrl,
      updatedAt,
    };
  });
}
