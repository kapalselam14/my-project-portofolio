import { useState } from 'react';
import type { ReactNode } from 'react';
import { Sidebar, MobileDrawer } from './Sidebar';
import { useTheme } from '../../context/ThemeContext';

export function DashboardShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header
          className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:hidden transition-colors duration-200"
          style={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-md p-1.5 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors"
            style={{ color: isDark ? '#94a3b8' : '#475569' }}
            aria-label="Open menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 overflow-hidden rounded">
              <img
                src="/logo-badge.png"
                alt="MatchUp logo"
                className="h-full w-full object-cover"
              />
            </div>
            <span
              className="text-sm font-bold transition-colors duration-200"
              style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
            >
              MatchUp Admin
            </span>
          </div>
        </header>

        {/* Scrollable page content */}
        <main
          className="flex-1 overflow-y-auto transition-colors duration-200"
          style={{ backgroundColor: isDark ? '#0f1117' : '#f8fafc' }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
