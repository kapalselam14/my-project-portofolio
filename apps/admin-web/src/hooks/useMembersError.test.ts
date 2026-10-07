// Tests for useMembersError.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Hoisted mocks expose rejected writes to tests of the hook's error propagation contract.
const { fetchMembersMock, updateMemberStatusMock, deleteMemberMock } = vi.hoisted(() => ({
  fetchMembersMock: vi.fn(),
  updateMemberStatusMock: vi.fn(),
  deleteMemberMock: vi.fn(),
}));
vi.mock('../services/membersService', () => ({
  fetchMembers: fetchMembersMock,
  updateMemberStatus: updateMemberStatusMock,
  deleteMember: deleteMemberMock,
}));

import { useMembers } from './useMembers';

describe('useMembers error surfacing (F9)', () => {
  // Reset calls and outcomes before checking each mutation's rejection path.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Bulk operations need the rejected promise to identify and summarize failed members.
  it('rethrows status-change failures so bulk callers can summarize them', async () => {
    fetchMembersMock.mockResolvedValue([
      {
        id: 'm1',
        name: 'A',
        username: 'a',
        email: 'a@x',
        role: 'Player',
        status: 'Active',
        sports: [],
        joinedDate: '',
        activitiesJoined: 0,
        activitiesHosted: 0,
        rating: 0,
        avatarSeed: 'm1',
      },
    ]);
    updateMemberStatusMock.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useMembers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(
      act(async () => {
        await result.current.handleStatusChange('m1', 'Suspended');
      }),
    ).rejects.toThrow('denied');
  });

  // Delete callers also own presenting the failure after the hook reloads its data.
  it('rethrows delete failures so callers can surface them', async () => {
    fetchMembersMock.mockResolvedValue([
      {
        id: 'm1',
        name: 'A',
        username: 'a',
        email: 'a@x',
        role: 'Player',
        status: 'Active',
        sports: [],
        joinedDate: '',
        activitiesJoined: 0,
        activitiesHosted: 0,
        rating: 0,
        avatarSeed: 'm1',
      },
    ]);
    deleteMemberMock.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useMembers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(
      act(async () => {
        await result.current.handleDelete('m1');
      }),
    ).rejects.toThrow('denied');
  });
});
