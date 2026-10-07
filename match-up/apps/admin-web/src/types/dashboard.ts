// KPI.

export interface KpiData {
  title: string;
  value: string;
  rawValue: number;
  change: string;
  dir: 'up' | 'down';
  sparkBars: number[];
  sparkColor: string;
}

// Trend chart.

export interface TrendPoint {
  day: string;
  activities: number;
  signups: number;
}

// Moderation.

export interface ModerationItem {
  id: string;
  reporter: string;
  target: string;
  targetType: 'user' | 'activity';
  reason: string;
  activityTitle: string;
  sport: string;
  createdAt: string; // ISO
}

// Activities table.

export type MatchStatus = 'Active' | 'Full' | 'Completed' | 'Flagged';

export interface ActivityRow {
  id: string;
  name: string;
  matchId: string;
  sport: string;
  host: string;
  hostAvatarSeed: string;
  photoUrl?: string;
  participants: number;
  capacity: number;
  status: MatchStatus;
  scheduledDate: string; // human-readable
}

// Dashboard response (full payload from API).

export interface DashboardData {
  kpis: KpiData[];
  trend: TrendPoint[];
  moderationQueue: ModerationItem[];
  activities: ActivityRow[];
}
