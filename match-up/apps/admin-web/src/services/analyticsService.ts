/** Analytics service — database-backed Firestore aggregates via api-server. */
import { apiFetch } from './api';

export interface WeeklyPoint {
  day: string;
  signups: number;
  activities: number;
  reports: number;
}

export interface SportStat {
  sport: string;
  activities: number;
  pct: number;
}

export interface RetentionPoint {
  label: string;
  value: number;
}

export interface HealthMetric {
  label: string;
  value: number;
  color: string;
}

export interface AnalyticsKpi {
  label: string;
  value: string;
  change: string;
}

export interface AnalyticsData {
  kpis: AnalyticsKpi[];
  weekly: WeeklyPoint[];
  topSports: SportStat[];
  retention: RetentionPoint[];
  health: HealthMetric[];
  note?: string;
}

export type AnalyticsRange = '7d' | '30d' | '90d';

export async function fetchAnalytics(
  range: AnalyticsRange = '7d',
): Promise<AnalyticsData> {
  // Include the selected window in the request so the server returns matching aggregates.
  const res = await apiFetch<AnalyticsData>(
    `/api/admin/analytics?range=${range}`,
  );

  if (!res.ok) {
    throw new Error(res.error.message);
  }

  return res.data;
}
