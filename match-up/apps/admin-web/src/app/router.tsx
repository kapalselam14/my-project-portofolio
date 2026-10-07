import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { DashboardShell } from '../components/layout/DashboardShell';
import { RequireAuth } from '../components/auth/RequireAuth';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { LoginPage } from '../pages/login/LoginPage';
import { MembersPage } from '../pages/members/MembersPage';
import { MemberDetailPage } from '../pages/members/MemberDetailPage';
import { ActivitiesPage } from '../pages/activities/ActivitiesPage';
import { ActivityDetailPage } from '../pages/activities/ActivityDetailPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { BroadcastsPage } from '../pages/broadcasts/BroadcastsPage';
import { AnalyticsPage } from '../pages/analytics/AnalyticsPage';
import { SportsPage } from '../pages/sports/SportsPage';
import { AppealsPage } from '../pages/appeals/AppealsPage';
import { NotificationTemplatesPage } from '../pages/notifications/NotificationTemplatesPage';
import { AuditLogPage } from '../pages/audit/AuditLogPage';
import { NotFoundPage } from '../pages/NotFoundPage';

function Shell({ children }: { children: React.ReactNode }) {
  // All dashboard pages share the auth gate and common admin navigation shell.
  return (
    <RequireAuth>
      <DashboardShell>{children}</DashboardShell>
    </RequireAuth>
  );
}

// Keep the route table exported so tests can audit its public and protected entries.
// eslint-disable-next-line react-refresh/only-export-components
export const routes = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <Shell>
        <DashboardPage />
      </Shell>
    ),
  },
  {
    path: '/members',
    element: (
      <Shell>
        <MembersPage />
      </Shell>
    ),
  },
  {
    path: '/members/:id',
    element: (
      <Shell>
        <MemberDetailPage />
      </Shell>
    ),
  },
  {
    path: '/activities',
    element: (
      <Shell>
        <ActivitiesPage />
      </Shell>
    ),
  },
  {
    path: '/activities/:id',
    element: (
      <Shell>
        <ActivityDetailPage />
      </Shell>
    ),
  },
  {
    path: '/reports',
    element: (
      <Shell>
        <ReportsPage />
      </Shell>
    ),
  },
  {
    path: '/broadcasts',
    element: (
      <Shell>
        <BroadcastsPage />
      </Shell>
    ),
  },
  {
    path: '/sports',
    element: (
      <Shell>
        <SportsPage />
      </Shell>
    ),
  },
  {
    path: '/analytics',
    element: (
      <Shell>
        <AnalyticsPage />
      </Shell>
    ),
  },
  {
    path: '/appeals',
    element: (
      <Shell>
        <AppealsPage />
      </Shell>
    ),
  },
  {
    path: '/notification-templates',
    element: (
      <Shell>
        <NotificationTemplatesPage />
      </Shell>
    ),
  },
  {
    path: '/audit-log',
    element: (
      <Shell>
        <AuditLogPage />
      </Shell>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
];

const router = createBrowserRouter(routes);

export function AppRouter() {
  // React Router owns URL matching and renders the selected page through this provider.
  return <RouterProvider router={router} />;
}
