import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthError } from '../../services/authService';

export function LoginPage() {
  const { signIn, isAuthenticated, loading: authLoading, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect to the page the user tried to visit (or dashboard).
  const from = (location.state as { from?: string })?.from ?? '/';

  // Already signed in — skip the login page.
  if (isAuthenticated) return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password, remember);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafc]">
      {/* Radial gradient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #eef2ff 0%, #f8fafc 100%)',
        }}
      />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[480px] rounded-3xl bg-white px-8 py-10 shadow-panel sm:px-10 sm:py-12">
        {/* Branding */}
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 overflow-hidden rounded-2xl shadow-card">
            <img src="/logo-badge.png" alt="MatchUp logo" className="h-full w-full object-cover" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold tracking-tight text-ink-900">MatchUp</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[1.5px] text-brand-400">
              Admin Console
            </p>
          </div>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-[26px] font-extrabold tracking-tight text-ink-900">Welcome Back</h1>
          <p className="mt-1 text-sm text-ink-600">Sign in to your admin account</p>
        </div>

        {/* Session-expired notice (auto logout) */}
        {sessionExpired && !error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-warning-500"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="7" />
              <path d="M8 5v4M8 11v.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-warning-700">
              Your session has expired. Please sign in again.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-danger-500"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="7" />
              <path d="M8 5v4M8 11v.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-danger-700">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-600">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="admin@matchup.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-600">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-11"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M10 4.5C5.75 4.5 2.27 7.36 1 10c1.27 2.64 4.75 5.5 9 5.5s7.73-2.86 9-5.5c-1.27-2.64-4.75-5.5-9-5.5z"
                      strokeLinecap="round"
                    />
                    <circle cx="10" cy="10" r="2.5" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M3 3l14 14M8.3 8.35A2.5 2.5 0 0012.5 12M5.15 5.2C3.34 6.35 2 8 1 10c1.27 2.64 4.75 5.5 9 5.5a9.6 9.6 0 004.83-1.3M7.5 4.63A9.6 9.6 0 0110 4.5c4.25 0 7.73 2.86 9 5.5a10.1 10.1 0 01-2.16 3"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={remember}
                onClick={() => setRemember((v) => !v)}
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 transition-colors ${remember ? 'border-brand-500 bg-brand-500' : 'border-ink-300 bg-white'}`}
              >
                {remember && (
                  <svg
                    className="h-2.5 w-2.5 text-white"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1.5 5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className="text-sm font-medium text-ink-600">
                Remember me <span className="text-ink-400">(30 days)</span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || authLoading}
            className="btn mt-2 w-full py-3 text-[15px] font-bold text-white rounded-xl disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #0b1f8a 0%, #ff6b00 100%)' }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
                </svg>
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      <p className="relative z-10 mt-8 text-[13px] text-ink-400">
        © 2026 MatchUp Sports. All rights reserved.
      </p>
    </div>
  );
}
