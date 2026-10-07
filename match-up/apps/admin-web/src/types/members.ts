export type MemberStatus = 'Active' | 'Suspended';
export type MemberRole = 'Player' | 'Host' | 'Moderator';

export interface Member {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role: MemberRole;
  status: MemberStatus;
  sports: { sport: string; level: string }[];
  bio?: string;
  location?: string;
  joinedDate: string;
  activitiesJoined: number;
  activitiesHosted: number;
  rating: number;
  /** UID-based seed for the initials fallback. Prefer photoUrl when present. */
  avatarSeed: string;
  photoUrl?: string;
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  goal?: string;
}
