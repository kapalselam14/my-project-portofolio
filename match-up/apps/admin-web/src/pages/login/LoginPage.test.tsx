// Tests for LoginPage.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { useAuthMock, navigateMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  navigateMock: vi.fn(),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { AuthError } from '../../services/authService';
import { LoginPage } from './LoginPage';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to "/" when already authenticated', () => {
    useAuthMock.mockReturnValue({
      signIn: vi.fn(),
      isAuthenticated: true,
      loading: false,
      sessionExpired: false,
    });
    renderLoginPage();
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('shows a validation error when submitting with empty fields', async () => {
    useAuthMock.mockReturnValue({
      signIn: vi.fn(),
      isAuthenticated: false,
      loading: false,
      sessionExpired: false,
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByText('Please enter your email and password.')).toBeInTheDocument();
  });

  it('signs in and navigates to the attempted page on success', async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      signIn,
      isAuthenticated: false,
      loading: false,
      sessionExpired: false,
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText('admin@matchup.app'), 'admin@matchup.app');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(signIn).toHaveBeenCalledWith('admin@matchup.app', 'secret123', false);
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows the AuthError message when sign-in is rejected', async () => {
    const signIn = vi.fn().mockRejectedValue(new AuthError('This account is not an admin.'));
    useAuthMock.mockReturnValue({
      signIn,
      isAuthenticated: false,
      loading: false,
      sessionExpired: false,
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText('admin@matchup.app'), 'x@y.com');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('This account is not an admin.')).toBeInTheDocument();
  });

  it('shows a generic message for a non-AuthError failure', async () => {
    const signIn = vi.fn().mockRejectedValue(new Error('boom'));
    useAuthMock.mockReturnValue({
      signIn,
      isAuthenticated: false,
      loading: false,
      sessionExpired: false,
    });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText('admin@matchup.app'), 'x@y.com');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Sign in failed. Please try again.')).toBeInTheDocument();
  });

  it('shows the session-expired banner when flagged, unless there is an error', async () => {
    useAuthMock.mockReturnValue({
      signIn: vi.fn(),
      isAuthenticated: false,
      loading: false,
      sessionExpired: true,
    });
    renderLoginPage();
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    useAuthMock.mockReturnValue({
      signIn: vi.fn(),
      isAuthenticated: false,
      loading: false,
      sessionExpired: false,
    });
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('toggles the remember-me checkbox', async () => {
    useAuthMock.mockReturnValue({
      signIn: vi.fn(),
      isAuthenticated: false,
      loading: false,
      sessionExpired: false,
    });
    const user = userEvent.setup();
    renderLoginPage();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
    await user.click(checkbox);
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });
});
