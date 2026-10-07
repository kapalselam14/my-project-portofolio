/** Dashboard service — database-backed (Firestore aggregates + reports + activities). */
import { fetchReports, reportAction } from './reportsService';
import { fetchAnalytics } from './analyticsService';
import { fetchActivities } from './activitiesService';
import type { ActivityRow, DashboardData, KpiData, ModerationItem } from '../types/dashboard';

interface DashboardView {
  totalUsers: number;
  activeActivities: number;
  pendingReports: number;
  newUsersWeek: number;
  topSports: { sport: string; activities: number; pct: number }[];
}

import { apiFetch } from './api';

function kpi(title: string, rawValue: number, sparkColor: string): KpiData {
  // Convert an aggregate into the display model expected by the dashboard cards.
  return {
    title,
    value: rawValue.toLocaleString('en-US'),
    rawValue,
    change: '',
    dir: 'up',
    sparkBars: [rawValue],
    sparkColor,
  };
}

export async function fetchDashboard(): Promise<DashboardData> {
  // Load dashboard sources concurrently, then adapt them into one page-level data model.
  const [stats, analytics, activities, moderationQueue] = await Promise.all([
    apiFetch<DashboardView>('/api/admin/dashboard').then((res) => {
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    }),
    fetchAnalytics('7d'),
    fetchActivities(),
    fetchModerationQueue(),
  ]);
  // Defensive defaults: a partial backend response must render empty cards, never crash.
  const weekly = Array.isArray(analytics.weekly) ? analytics.weekly : [];
  const rows = Array.isArray(activities) ? activities : [];
  const queue = Array.isArray(moderationQueue) ? moderationQueue : [];
  return {
    kpis: [
      kpi('Total Users', Number(stats.totalUsers) || 0, 'var(--brand-graphic)'),
      kpi('Active Activities', Number(stats.activeActivities) || 0, '#16a34a'),
      kpi('Pending Reports', Number(stats.pendingReports) || 0, '#dc2626'),
      kpi('New Users (7d)', Number(stats.newUsersWeek) || 0, '#7c3aed'),
    ],
    trend: weekly.map((w) => ({
      day: typeof w.day === 'string' ? w.day : '',
      activities: Number(w.activities) || 0,
      signups: Number(w.signups) || 0,
    })),
    moderationQueue: queue,
    // Keep the dashboard preview short and normalize statuses for its smaller activity summary.
    activities: rows.slice(0, 8).map((a): ActivityRow => ({
      id: a.id,
      name: a.name,
      matchId: a.matchId,
      sport: a.sport,
      host: a.host,
      hostAvatarSeed: a.hostAvatarSeed,
      photoUrl: a.photoUrl,
      participants: a.participants,
      capacity: a.capacity,
      status:
        a.status === 'Active' || a.status === 'Full' || a.status === 'Completed'
          ? a.status
          : 'Flagged',
      scheduledDate: a.scheduledDate,
    })),
  };
}

export async function fetchModerationQueue(): Promise<ModerationItem[]> {
  // Only pending reports belong in the actionable moderation queue.
  const pending = await fetchReports('pending');
  return pending.map((r) => ({
    id: r.id,
    reporter: r.reporter,
    target: r.target,
    targetType: r.targetType,
    reason: r.reason,
    activityTitle: r.activityTitle,
    sport: r.sport,
    createdAt: r.createdAt,
  }));
}

export type ModAction = 'resolve' | 'dismiss';

export async function moderationAction(
  id: string,
  action: ModAction,
  note?: string,
): Promise<void> {
  return reportAction(id, action, note);
}
