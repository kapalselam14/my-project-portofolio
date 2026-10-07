// Tests for MemberDetailPage.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const { fetchMemberMock, updateMemberStatusMock, deleteMemberMock } = vi.hoisted(() => ({
  fetchMemberMock: vi.fn(),
  updateMemberStatusMock: vi.fn(),
  deleteMemberMock: vi.fn(),
}));
vi.mock('../../services/membersService', () => ({
  fetchMember: fetchMemberMock,
  updateMemberStatus: updateMemberStatusMock,
  deleteMember: deleteMemberMock,
}));

import { MemberDetailPage } from './MemberDetailPage';

function makeMember(overrides = {}) {
  return {
    id: 'm1',
    name: 'Alice',
    username: '@alice',
    email: 'a@x.com',
    role: 'Player',
    status: 'Active',
    sports: [],
    joinedDate: 'Jan 1',
    activitiesJoined: 1,
    activitiesHosted: 0,
    rating: 4,
    avatarSeed: 'm1',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/members/m1']}>
      <Routes>
        <Route path="/members" element={<div>members list</div>} />
        <Route path="/members/:id" element={<MemberDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MemberDetailPage audit fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('F6: shows Suspend/Remove actions for an active member', async () => {
    fetchMemberMock.mockResolvedValue(makeMember({ status: 'Active' }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('F6: suspend asks for confirmation then calls the service', async () => {
    fetchMemberMock.mockResolvedValue(makeMember({ status: 'Active' }));
    updateMemberStatusMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Suspend' }));
    const confirms = screen.getAllByRole('button', { name: 'Suspend' });
    await user.click(confirms[confirms.length - 1]);
    await waitFor(() => expect(updateMemberStatusMock).toHaveBeenCalledWith('m1', 'Suspended'));
  });

  it('F6+F10: network error shows message with Retry instead of silent null', async () => {
    fetchMemberMock.mockRejectedValue(new Error('Network Error'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load member/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('F6: not-found error shows not-found copy without Retry', async () => {
    fetchMemberMock.mockRejectedValue(new Error('404 Not Found'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Member not found.')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
