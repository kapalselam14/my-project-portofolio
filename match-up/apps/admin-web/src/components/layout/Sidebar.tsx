import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';
import { useTheme } from '../../context/ThemeContext';

// Icons.

function IconDashboard() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="1" width="7" height="7" rx="1.5" />
      <rect x="10" y="1" width="7" height="7" rx="1.5" />
      <rect x="1" y="10" width="7" height="7" rx="1.5" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7" cy="5.5" r="3" />
      <path d="M1 16c0-3.314 2.686-5 6-5s6 1.686 6 5" />
      <path d="M12 3a3 3 0 010 5" />
      <path d="M17 16c0-2.5-1.5-4-3-4.5" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="3" width="16" height="14" rx="2" />
      <path d="M1 7h16" />
      <path d="M5 1v4M13 1v4" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1a5 5 0 015 5c0 5 2 6 2 6H2s2-1 2-6a5 5 0 015-5z" />
      <path d="M7.27 15.5a2 2 0 003.46 0" />
    </svg>
  );
}
function IconAirplay() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 14H2a1 1 0 01-1-1V3a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1h-3" />
      <path d="M9 10l-4 7h8l-4-7z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1,13 6,8 10,11 17,4" />
      <path d="M13 4h4v4" />
    </svg>
  );
}
function IconAppeals() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1a8 8 0 100 16A8 8 0 009 1z" />
      <path d="M9 6v4M9 12h.01" />
    </svg>
  );
}
function IconTemplate() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 1a5 5 0 015 5c0 5 2 6 2 6H2s2-1 2-6a5 5 0 015-5z" />
      <path d="M6.27 14.5a3 3 0 005.46 0" />
      <path d="M9 1V0" />
    </svg>
  );
}
function IconAuditLog() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 1h8l3 3v11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 013 15V2.5A1.5 1.5 0 014.5 1z" />
      <path d="M6 6h6M6 9h6M6 12h4" />
    </svg>
  );
}

// Nav config.

function IconSports() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="9" r="7.5" />
      <path d="M9 1.5a7.5 7.5 0 010 15M1.5 9h15" />
      <path d="M3.5 4.5C5.5 5.5 7 7 7 9s-1.5 3.5-3.5 4.5M14.5 4.5C12.5 5.5 11 7 11 9s1.5 3.5 3.5 4.5" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: <IconDashboard />, end: true },
  { to: '/members', label: 'Members', icon: <IconUsers /> },
  { to: '/activities', label: 'Activities', icon: <IconCalendar /> },
  { to: '/reports', label: 'Reports', icon: <IconBell /> },
  { to: '/broadcasts', label: 'Broadcasts', icon: <IconAirplay /> },
  { to: '/appeals', label: 'Appeals', icon: <IconAppeals /> },
  { to: '/sports', label: 'Sports', icon: <IconSports /> },
  { to: '/analytics', label: 'Analytics', icon: <IconChart /> },
  { to: '/notification-templates', label: 'Notif Templates', icon: <IconTemplate /> },
  { to: '/audit-log', label: 'Audit Log', icon: <IconAuditLog /> },
] as const;

// Inner sidebar content.

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const colors = {
    text: isDark ? '#f1f5f9' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#475569',
    textFaint: isDark ? '#64748b' : '#94a3b8',
    border: isDark ? '#334155' : '#e2e8f0',
    navActive: isDark ? 'rgba(11,31,138,0.25)' : '#eef2ff',
    navActiveText: isDark ? '#8fadf6' : '#0f1a52',
    navHover: isDark ? 'rgba(51,65,85,0.6)' : '#f8fafc',
    iconActive: isDark ? '#8fadf6' : '#0f1a52',
    iconDefault: isDark ? '#64748b' : '#94a3b8',
  };

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className="flex h-[85px] shrink-0 items-center gap-3 px-6 border-b"
        style={{ borderColor: colors.border }}
      >
        <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-lg">
          <img src="/logo-badge.png" alt="MatchUp logo" className="h-full w-full object-cover" />
        </div>
        <div>
          <p className="text-[18px] font-bold leading-none" style={{ color: colors.text }}>
            MatchUp
          </p>
          <p className="mt-0.5 text-[11px] font-semibold leading-none tracking-wide text-brand-400">
            ADMIN CONSOLE
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-4 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : undefined}
            onClick={onNavigate}
          >
            {({ isActive }) => (
              <span
                className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? colors.navActive : 'transparent',
                  color: isActive ? colors.navActiveText : colors.textMuted,
                  fontWeight: isActive ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor = colors.navHover;
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ color: isActive ? colors.iconActive : colors.iconDefault }}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Admin footer */}
      <div
        className="flex shrink-0 items-center gap-3 border-t px-4 py-4"
        style={{ borderColor: colors.border }}
      >
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-200">
          <Avatar
            name={user && typeof user === 'object' ? (user?.name ?? 'Admin') : 'Admin'}
            photoUrl={user && typeof user === 'object' ? user.photoUrl : undefined}
            seed={user && typeof user === 'object' ? user.avatarSeed : undefined}
            className="h-9 w-9 rounded-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: colors.text }}>
            {user && typeof user === 'object' ? user.name : '—'}
          </p>
          <p className="truncate text-xs" style={{ color: colors.textFaint }}>
            {user && typeof user === 'object' ? user.role : ''}
          </p>
        </div>
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="shrink-0 rounded-md p-1.5 transition-colors"
          style={{ color: colors.textMuted }}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <circle cx="8" cy="8" r="3.5" />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M13.5 10A6 6 0 016 2.5a6 6 0 100 11 6 6 0 007.5-3.5z" />
            </svg>
          )}
        </button>
        <button
          onClick={handleSignOut}
          className="shrink-0 rounded-md p-1.5 transition-colors hover:text-danger-500"
          style={{ color: colors.textMuted }}
          aria-label="Sign out"
          title="Sign out"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" />
            <path d="M11 11l3-3-3-3M14 8H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Desktop sidebar.

export function Sidebar() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <aside
      className="hidden h-full w-[260px] shrink-0 border-r border-ink-200 dark:border-ink-700 md:flex md:flex-col transition-colors duration-200"
      style={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : undefined,
      }}
    >
      <SidebarContent />
    </aside>
  );
}

// Mobile drawer overlay.

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Scrim */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-ink-900/50 transition-opacity md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 transition-transform duration-300 md:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navigation"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-700 hover:text-ink-700 dark:hover:text-ink-100"
          aria-label="Close menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}
