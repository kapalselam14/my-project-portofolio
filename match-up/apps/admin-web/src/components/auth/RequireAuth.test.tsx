// Tests for RequireAuth.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: useAuthMock }));

import { RequireAuth } from './RequireAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('shows a loading spinner while the session is being checked (user === null)', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { container } = renderAt('/protected');
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to /login when signed out (user === false)', () => {
    useAuthMock.mockReturnValue({ user: false });
    renderAt('/protected');
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders children when signed in', () => {
    useAuthMock.mockReturnValue({ user: { id: 'u1', name: 'Alice' } });
    renderAt('/protected');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
