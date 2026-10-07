import type { PublicUserProfile } from '../users/users.service.js';
import type { SwipeDecision } from '../swipes/swipes.service.js';
// Activity domain types + barrel. Logic lives in queries/mutations/enrichment/pricing.

export type ActivityStatus = 'open' | 'full' | 'cancelled' | 'completed' | 'removed';

export type ActivitySkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'any';

/** How new members get in. */
export type ActivityJoinPolicy = 'open' | 'approval';

export type ActivityFeeMode = 'fixed' | 'split';

export type CreateActivityInput = {
  hostId: string;
  title: string;
  sportType: string;
  description?: string;
  locationName: string;
  address?: string;
  latitude: number;
  longitude: number;
  geohash: string;
  startTime: string;
  endTime?: string;
  skillLevel: ActivitySkillLevel;
  capacity: number;
  coverImageUrl?: string;
  joinPolicy?: ActivityJoinPolicy;
  /** Whether joining costs money. When `true`, `fee` must be a positive number (NZD per person). */
  isPaid?: boolean;
  /** Entry fee in NZD. Only stored when `isPaid` is true. */
  fee?: number;
  /** Pricing mode: flat per person (`fixed`, default) or shared total (`split`). */
  feeMode?: ActivityFeeMode;
  /** Total cost to split (NZD). Required for `split` mode. */
  totalCost?: number;
  /** Minimum players for split mode. Defaults to full capacity. */
  minPlayers?: number;
  /** Weather snapshot captured at creation (Open-Meteo, best-effort). */
  weatherTemp?: number | null;
  weatherCode?: number;
  weatherDesc?: string;
  weatherRain?: number;
};

export type UpdateActivityStatusInput = {
  activityId: string;
  hostId: string;
  status: Exclude<ActivityStatus, 'full'>;
};

export type UpdateActivityCoverInput = {
  activityId: string;
  hostId: string;
  coverImagePath: string;
  coverImageUrl: string;
};

export type UpdateActivityInput = {
  activityId: string;
  hostId: string;
  title?: string;
  sportType?: string;
  description?: string;
  locationName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geohash?: string;
  startTime?: string;
  endTime?: string;
  skillLevel?: ActivitySkillLevel;
  capacity?: number;
  coverImageUrl?: string;
  joinPolicy?: ActivityJoinPolicy;
  isPaid?: boolean;
  fee?: number;
  feeMode?: ActivityFeeMode;
  totalCost?: number;
  minPlayers?: number;
  weatherTemp?: number | null;
  weatherCode?: number;
  weatherDesc?: string;
  weatherRain?: number;
};

export type ActivityRecord = {
  hostId: string;
  title: string;
  sportType: string;
  description: string;
  locationName: string;
  address?: string;
  latitude: number;
  longitude: number;
  geohash: string;
  startTime: string;
  endTime?: string;
  skillLevel: ActivitySkillLevel;
  capacity: number;
  participantCount: number;
  /** Denormalized count of `pending` join requests (approval-gated activities). */
  pendingRequestCount: number;
  status: ActivityStatus;
  coverImagePath?: string;
  coverImageUrl?: string;
  joinPolicy?: ActivityJoinPolicy;
  /** Whether joining costs money. */
  isPaid: boolean;
  /** Entry fee in NZD per person. */
  fee?: number;
  /** Pricing mode for paid activities (`fixed` = flat per person, `split` = shared total). */
  feeMode?: ActivityFeeMode;
  /** Total cost to split (NZD). */
  totalCost?: number;
  /** Minimum players for `split` mode. */
  minPlayers?: number;
  /** Weather snapshot (see [CreateActivityInput]). */
  weatherTemp?: number | null;
  weatherCode?: number;
  weatherDesc?: string;
  weatherRain?: number;
  cancelledAt?: FirebaseFirestore.Timestamp;
  cancelledBy?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};
/** One "I want sport X at skill Y" entry from the mobile filter sheet. */

/** One "I want sport X at skill Y" entry from the mobile filter sheet. */
export type SportSkillFilter = {
  sport: string;
  skill: ActivitySkillLevel | 'any';
};

export type ListActivitiesFilters = {
  status?: ActivityStatus;
  sportType?: string;
  skillLevel?: ActivitySkillLevel;
  limit: number;
  /** When set, ranked by preference match first, then proximity, then soonest start time, then newest created. */
  discover?: {
    near?: { latitude: number; longitude: number; radiusKm: number };
    /** Inclusive start-time lower bound (ISO). */
    startAfter?: string;
    /** Inclusive start-time upper bound (ISO). */
    startBefore?: string;
    /** Sport+skill entries — empty means no sport filter. */
    sportFilters: SportSkillFilter[];
    /** Set of activityIds the viewer has already swiped on. */
    excludeActivityIds?: string[];
    /** When true, passed cards are kept in the results while right-swiped (joined) cards stay excluded. */
    includeSwiped?: boolean;
  };
  /** Authenticated viewer's uid — required whenever `discover` is set. */
  viewerUid?: string;
};

export type ActivityWithId = ActivityRecord & {
  activityId: string;
  hostProfile: PublicUserProfile | null;
};

export type JoinRequestStatus = 'none' | 'pending' | 'approved' | 'declined';

export type ActivityViewerContext = {
  mySwipeDecision: SwipeDecision | null;
  isParticipant: boolean;
  isHost: boolean;
  /** The viewer's join-request state for approval-gated activities. */
  joinRequestStatus: JoinRequestStatus;
};

export type ActivityWithViewerContext = ActivityWithId & ActivityViewerContext;

export type PublicActivityTeaser = {
  activityId: string;
  title: string;
  sportType: string;
  locationName: string;
  latitude: number;
  longitude: number;
  startTime: string;
  skillLevel: ActivitySkillLevel;
  availableSpots: number;
  coverImageUrl?: string;
};

export type ActivityBaseWithId = ActivityRecord & {
  activityId: string;
};

export * from './activity-queries.js';
export * from './activity-mutations.js';
export * from './activity-enrichment.js';
export * from './activity-pricing.js';
