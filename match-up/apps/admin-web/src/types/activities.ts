// activities.
export type ActivityStatus = 'Active' | 'Full' | 'Completed' | 'Cancelled' | 'Flagged';

export interface AdminActivity {
  id: string;
  name: string;
  matchId: string;
  sport: string;
  skillLevel: string;
  host: string;
  hostAvatarSeed: string;
  photoUrl?: string;
  hostRating: number;
  hostGamesCount: number;
  location: string;
  addressLine?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  participants: number;
  capacity: number;
  status: ActivityStatus;
  description: string;
  isPaid: boolean;
  fee?: number;
  vibeTags: string[];
  distanceKm?: number;
}
