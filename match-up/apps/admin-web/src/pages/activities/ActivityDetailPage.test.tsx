// Tests for ActivityDetailPage.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Share service and toast mocks with the hook/page imports so each test can control outcomes.
const { fetchActivitiesMock, updateActivityStatusMock, deleteActivityMock, toastPushMock } =
  vi.hoisted(() => ({
    fetchActivitiesMock: vi.fn(),
    updateActivityStatusMock: vi.fn(),
    deleteActivityMock: vi.fn(),
    toastPushMock: vi.fn(),
  }));
vi.mock('../../services/activitiesService', () => ({
  fetchActivities: fetchActivitiesMock,
  updateActivityStatus: updateActivityStatusMock,
  deleteActivity: deleteActivityMock,
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: toastPushMock }) }));

import { ActivityDetailPage } from './ActivityDetailPage';

// Create a complete activity fixture and override only values relevant to a scenario.
function makeActivity(overrides = {}) {
  return {
    id: 'a1',
    name: 'Sunday Futsal',
    matchId: 'A1',
    sport: 'Futsal',
    skillLevel: 'Beginner',
    host: 'Alice',
    hostAvatarSeed: 'u1',
    hostRating: 4.5,
    hostGamesCount: 3,
    location: 'Gym',
    scheduledDate: 'Feb 1',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    participants: 2,
    capacity: 10,
    status: 'Active',
    description: 'Fun game',
    isPaid: false,
    vibeTags: [],
    ...overrides,
  };
}

// Mount the detail page at a realistic route with a list destination for navigation.
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/activities/a1']}>
      <Routes>
        <Route path="/activities" element={<div>activities list</div>} />
        <Route path="/activities/:id" element={<ActivityDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ActivityDetailPage audit fixes', () => {
  // The cases cover available moderation actions, confirmation, and load-error recovery.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('F7: shows Cancel / Mark Completed / Delete actions', async () => {
    fetchActivitiesMock.mockResolvedValue([makeActivity()]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Sunday Futsal')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Completed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('F7: cancel confirms then calls updateActivityStatus', async () => {
    fetchActivitiesMock.mockResolvedValue([makeActivity()]);
    updateActivityStatusMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Sunday Futsal')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Cancel Activity' }));
    await waitFor(() => expect(updateActivityStatusMock).toHaveBeenCalledWith('a1', 'Cancelled'));
  });

  it('F7+F10: load failure shows error with Retry', async () => {
    fetchActivitiesMock.mockRejectedValue(new Error('offline'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load activity/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
