import { describe, expect, it } from 'vitest';
import { routes } from './router';
import { NotFoundPage } from '../pages/NotFoundPage';

describe('router audit fixes', () => {
  // The wildcard route stays outside the protected shell so not-found pages remain public.
  it('P2: wildcard 404 route renders publicly (not inside the auth Shell)', () => {
    const wildcard = routes.find((r) => r.path === '*');
    expect(wildcard).toBeDefined();
    // Public: element must be exactly <NotFoundPage /> — no RequireAuth/Shell wrapper.
    expect(wildcard!.element).toBeDefined();
    expect((wildcard!.element as React.ReactElement).type).toBe(NotFoundPage);
  });
});
