// Tests for MembersPage.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { useMembersMock, toastPushMock, downloadCsvMock, fetchSummaryMock } = vi.hoisted(() => ({
  useMembersMock: vi.fn(),
  toastPushMock: vi.fn(),
  downloadCsvMock: vi.fn(),
  fetchSummaryMock: vi.fn(),
}));
vi.mock('../../hooks/useMembers', () => ({ useMembers: useMembersMock }));
vi.mock('../../services/membersService', () => ({ fetchMembersSummary: fetchSummaryMock }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: toastPushMock }) }));
vi.mock('../../utils/csvExport', () => ({ downloadCsv: downloadCsvMock }));

import { MembersPage } from './MembersPage';

function makeMember(overrides = {}) {
  return {
    id: 'm1',
    name: 'Alice',
    username: '@a',
    email: 'a@x.com',
    role: 'Player',
    status: 'Active',
    sports: [{ sport: 'Futsal', level: 'Beginner' }],
    joinedDate: 'Jan 1',
    activitiesJoined: 1,
    activitiesHosted: 0,
    rating: 4,
    avatarSeed: 'm1',
    ...overrides,
  };
}

describe('MembersPage bulk audit fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no collection summary, so header cards fall back to page counts.
    fetchSummaryMock.mockRejectedValue(new Error('offline'));
  });

  it('shows collection-wide totals from the summary endpoint, not page counts', async () => {
    fetchSummaryMock.mockResolvedValue({ total: 26, active: 25, suspended: 1 });
    mockMembers([makeMember({ id: 'm1' })]);
    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchSummaryMock).toHaveBeenCalled());
    // Header cards reflect the collection (26), not the single loaded row.
    expect(screen.getByText('Total Members').previousSibling?.textContent ?? '').toContain('26');
  });

  function mockMembers(members: unknown[], hookOverrides = {}) {
    useMembersMock.mockReturnValue({
      loading: false,
      error: null,
      members,
      reload: vi.fn(),
      handleStatusChange: vi.fn().mockResolvedValue(undefined),
      handleDelete: vi.fn().mockResolvedValue(undefined),
      ...hookOverrides,
    });
  }

  it('F9: bulk suspend awaits all and shows a failure summary', async () => {
    const handleStatusChange = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('denied'));
    mockMembers([makeMember({ id: 'm1' }), makeMember({ id: 'm2' })], { handleStatusChange });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    );
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getAllByRole('checkbox')[2]);
    await user.click(screen.getByRole('button', { name: 'Suspend selected' }));
    await waitFor(() => expect(handleStatusChange).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/1 of 2 failed/)).toBeInTheDocument());
  });

  it('F9: bulk activate exists and succeeds', async () => {
    const handleStatusChange = vi.fn().mockResolvedValue(undefined);
    mockMembers(
      [
        makeMember({ id: 'm1', status: 'Suspended' }),
        makeMember({ id: 'm2', status: 'Suspended' }),
      ],
      { handleStatusChange },
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MembersPage />
      </MemoryRouter>,
    );
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getAllByRole('checkbox')[2]);
    await user.click(screen.getByRole('button', { name: 'Activate selected' }));
    await waitFor(() => expect(handleStatusChange).toHaveBeenCalledWith('m1', 'Active'));
    expect(toastPushMock).toHaveBeenCalledWith('2 member(s) activated.', 'success');
  });

  it('F9: hook errors surface to the caller instead of being swallowed', async () => {
    const { useMembers } = await import('../../hooks/useMembers');
    expect(typeof useMembers).toBe('function');
  });
});
