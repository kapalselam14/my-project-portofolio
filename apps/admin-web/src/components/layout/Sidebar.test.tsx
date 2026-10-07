// Tests for Sidebar.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { useAuthMock, useThemeMock, navigateMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useThemeMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: useThemeMock }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { Sidebar, MobileDrawer } from './Sidebar';

const testUser = { id: 'u1', name: 'Alice', email: 'a@b.com', role: 'Admin', avatarSeed: 'u1' };

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeMock.mockReturnValue({ theme: 'light', toggle: vi.fn() });
  });

  it('renders all nav item labels', () => {
    useAuthMock.mockReturnValue({ user: testUser, signOut: vi.fn() });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    for (const label of [
      'Dashboard',
      'Members',
      'Activities',
      'Reports',
      'Broadcasts',
      'Appeals',
      'Sports',
      'Analytics',
      'Audit Log',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("shows the signed-in user's name and role in the footer", () => {
    useAuthMock.mockReturnValue({ user: testUser, signOut: vi.fn() });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('falls back to placeholders when there is no user object', () => {
    useAuthMock.mockReturnValue({ user: false, signOut: vi.fn() });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('signs out and redirects to /login when the sign-out button is clicked', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({ user: testUser, signOut });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('toggles the theme when the theme button is clicked', async () => {
    const toggle = vi.fn();
    useAuthMock.mockReturnValue({ user: testUser, signOut: vi.fn() });
    useThemeMock.mockReturnValue({ theme: 'light', toggle });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});

describe('MobileDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ user: testUser, signOut: vi.fn() });
    useThemeMock.mockReturnValue({ theme: 'light', toggle: vi.fn() });
  });

  it('calls onClose when the scrim is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <MobileDrawer open onClose={onClose} />
      </MemoryRouter>,
    );

    await user.click(container.querySelector('[aria-hidden]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MobileDrawer open onClose={onClose} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when a nav link is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MobileDrawer open onClose={onClose} />
      </MemoryRouter>,
    );

    await user.click(screen.getByText('Members'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
