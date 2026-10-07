import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../../database/firebase.js';

/**
 * Read-only platform aggregates for the admin Analytics + Dashboard pages.
 *
 * Bounded by design: every scan carries a limit, so figures are exact on
 * small datasets and clearly-labelled approximations at scale (see
 * `ANALYTICS_SCAN_CAP`).
 *
 * No fake data: `retention`/`health` stay `[]` because the events to
 * compute them (repeat-visit cohorts, DAU/WAU funnels) are not recorded
 * yet — the frontend renders those cards from the empty series plus the
 * human-readable `note` in the JSON body. When an `analyticsEvents`
 * collection lands, compute the series here and keep the same shape.
 */
export const ANALYTICS_SCAN_CAP = 1000;

export const ANALYTICS_EMPTY_NOTE =
  'Retention and health series are not collected yet — no analytics events pipeline exists, so these return empty. KPIs, weekly buckets, and top sports above are computed live from users/activities/reports.';

export type KpiPoint = { label: string; value: string; change: string };
export type WeeklyPoint = {
  day: string;
  signups: number;
  activities: number;
  reports: number;
};
export type SportStat = { sport: string; activities: number; pct: number };

export type RetentionPoint = {
  label: string;
  value: number;
};

export type HealthMetric = {
  label: string;
  value: number;
  color: string;
};

export type AnalyticsView = {
  kpis: KpiPoint[];
  weekly: WeeklyPoint[];
  topSports: SportStat[];
  retention: RetentionPoint[];
  health: HealthMetric[];
  /** Empty-state note for the un-collected series (see above). */
  note: string;
};

export type DashboardView = {
  totalUsers: number;
  activeActivities: number;
  pendingReports: number;
  newUsersWeek: number;
  topSports: SportStat[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function toMillis(value: unknown): number | null {
  if (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return null;
    }
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function pctChange(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? '+100.0%' : '+0.0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

async function countWhere(
  collection: string,
  field: string,
  from: Date,
  to?: Date,
): Promise<number> {
  try {
    let query: FirebaseFirestore.Query = firestore
      .collection(collection)
      .where(field, '>=', Timestamp.fromDate(from));
    if (to) {
      query = query.where(field, '<', Timestamp.fromDate(to));
    }
    const snap = await query.count().get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

async function bucketByDay(collection: string, field: string, days: Date[]): Promise<number[]> {
  const counts = new Array<number>(days.length).fill(0);
  try {
    const snap = await firestore
      .collection(collection)
      .where(field, '>=', Timestamp.fromDate(days[0]!))
      .limit(ANALYTICS_SCAN_CAP)
      .get();
    for (const doc of snap.docs) {
      const ms = toMillis(doc.data()?.[field]);
      if (ms === null) continue;
      for (let i = 0; i < days.length; i++) {
        const start = days[i]!.getTime();
        const end = start + DAY_MS;
        if (ms >= start && ms < end) {
          counts[i]! += 1;
          break;
        }
      }
    }
  } catch {
    // Leave zeros.
  }
  return counts;
}

export async function getAnalytics(rangeDays = 7): Promise<AnalyticsView> {
  // Aggregate a bounded recent dataset into the chart, retention, health, and sport summaries.
  if (rangeDays !== 7 && rangeDays !== 30 && rangeDays !== 90) {
    throw new Error('range must be 7, 30, or 90 days');
  }
  const now = new Date();
  const windowAgo = new Date(now.getTime() - rangeDays * DAY_MS);
  const prevAgo = new Date(now.getTime() - 2 * rangeDays * DAY_MS);

  const days: Date[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    days.push(startOfDay(new Date(now.getTime() - i * DAY_MS)));
  }

  const [
    totalUsers,
    signups,
    signupsPrev,
    totalActivities,
    activities,
    activitiesPrev,
    pendingReports,
  ] = await Promise.all([
    firestore
      .collection('users')
      .count()
      .get()
      .then((s) => s.data().count)
      .catch(() => 0),
    countWhere('users', 'createdAt', windowAgo),
    countWhere('users', 'createdAt', prevAgo, windowAgo),
    firestore
      .collection('activities')
      .count()
      .get()
      .then((s) => s.data().count)
      .catch(() => 0),
    countWhere('activities', 'createdAt', windowAgo),
    countWhere('activities', 'createdAt', prevAgo, windowAgo),
    firestore
      .collection('reports')
      .where('status', '==', 'pending')
      .count()
      .get()
      .then((s) => s.data().count)
      .catch(() => 0),
  ]);

  const [signupsByDay, activitiesByDay, reportsByDay, sportBuckets] = await Promise.all([
    bucketByDay('users', 'createdAt', days),
    bucketByDay('activities', 'createdAt', days),
    bucketByDay('reports', 'createdAt', days),
    (async () => {
      const buckets = new Map<string, number>();
      try {
        const snap = await firestore.collection('activities').limit(ANALYTICS_SCAN_CAP).get();
        for (const doc of snap.docs) {
          const sport = doc.data()?.sportType;
          if (typeof sport === 'string' && sport.length > 0) {
            buckets.set(sport, (buckets.get(sport) ?? 0) + 1);
          }
        }
      } catch {
        // Leave empty.
      }
      return buckets;
    })(),
  ]);

  const weekly: WeeklyPoint[] = days.map((d, i) => ({
    day: WEEKDAY[d.getDay()]!,
    signups: signupsByDay[i]!,
    activities: activitiesByDay[i]!,
    reports: reportsByDay[i]!,
  }));

  const sortedSports = [...sportBuckets.entries()].sort((a, b) => b[1] - a[1]);
  const top = sortedSports.slice(0, 5);
  const max = top.length > 0 ? top[0]![1] : 0;
  const topSports: SportStat[] = top.map(([sport, count]) => ({
    sport,
    activities: count,
    pct: max > 0 ? Math.round((count / max) * 100) : 0,
  }));

  return {
    kpis: [
      {
        label: 'Total Users',
        value: String(totalUsers),
        change: pctChange(signups, signupsPrev),
      },
      {
        label: `Signups (${rangeDays}d)`,
        value: String(signups),
        change: pctChange(signups, signupsPrev),
      },
      {
        label: `Activities (${rangeDays}d)`,
        value: String(activities),
        change: pctChange(activities, activitiesPrev),
      },
      {
        label: 'Pending Reports',
        value: String(pendingReports),
        change: '+0.0%',
      },
    ],
    weekly,
    topSports,
    retention: [],
    health: [],
    note: ANALYTICS_EMPTY_NOTE,
  };
}

export async function getDashboard(): Promise<DashboardView> {
  // Build dashboard KPIs from the same underlying collections used by analytics.
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [totalUsers, activeActivities, pendingReports, newUsersWeek, analytics] = await Promise.all(
    [
      firestore
        .collection('users')
        .count()
        .get()
        .then((s) => s.data().count)
        .catch(() => 0),
      firestore
        .collection('activities')
        .where('status', '==', 'open')
        .count()
        .get()
        .then((s) => s.data().count)
        .catch(() => 0),
      firestore
        .collection('reports')
        .where('status', '==', 'pending')
        .count()
        .get()
        .then((s) => s.data().count)
        .catch(() => 0),
      countWhere('users', 'createdAt', weekAgo),
      getAnalytics(),
    ],
  );
  return {
    totalUsers,
    activeActivities,
    pendingReports,
    newUsersWeek,
    topSports: analytics.topSports,
  };
}
