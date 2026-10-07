// Tests for DashboardPage.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useDashboardMock } = vi.hoisted(() => ({ useDashboardMock: vi.fn() }));
vi.mock('../../hooks/useDashboard', () => ({ useDashboard: useDashboardMock }));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
}));

import { DashboardPage } from './DashboardPage';

describe('DashboardPage audit fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockData(handleModAction: ReturnType<typeof vi.fn>) {
    useDashboardMock.mockReturnValue({
      loading: false,
      error: null,
      reload: vi.fn(),
      handleModAction,
      data: {
        kpis: [],
        trend: [],
        moderationQueue: [
          {
            id: 'r1',
            reporter: 'Alice',
            target: 'Bob',
            targetType: 'user',
            reason: 'spam',
            activityTitle: 'Game',
            sport: 'Futsal',
            createdAt: '2026-01-01',
          },
        ],
        activities: [],
      },
    });
  }

  it('F8: resolve opens a note prompt and forwards the note', async () => {
    const handleModAction = vi.fn();
    mockData(handleModAction);
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(screen.getByPlaceholderText(/Reason \/ note/)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Reason \/ note/), 'confirmed spam');
    const confirms = screen.getAllByRole('button', { name: 'Resolve' });
    await user.click(confirms[confirms.length - 1]);
    await waitFor(() =>
      expect(handleModAction).toHaveBeenCalledWith('r1', 'resolve', 'confirmed spam'),
    );
  });

  it('F8: dismiss without a note forwards undefined', async () => {
    const handleModAction = vi.fn();
    mockData(handleModAction);
    const user = userEvent.setup();
    render(<DashboardPage />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    const confirms = screen.getAllByRole('button', { name: 'Dismiss' });
    await user.click(confirms[confirms.length - 1]);
    await waitFor(() => expect(handleModAction).toHaveBeenCalledWith('r1', 'dismiss', undefined));
  });
});
