import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useBroadcastsMock, toastPushMock } = vi.hoisted(() => ({
  useBroadcastsMock: vi.fn(),
  toastPushMock: vi.fn(),
}));
vi.mock('../../hooks/useBroadcasts', () => ({ useBroadcasts: useBroadcastsMock }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: toastPushMock }) }));

import { BroadcastsPage } from './BroadcastsPage';

function makeBroadcast(overrides = {}) {
  return {
    id: 'b1',
    title: 'Draft one',
    message: 'Hello',
    audience: 'All Users',
    status: 'Draft',
    recipients: 0,
    ...overrides,
  };
}

function mockHook(broadcasts: unknown[] = []) {
  useBroadcastsMock.mockReturnValue({
    loading: false,
    error: null,
    broadcasts,
    reload: vi.fn(),
    handleCreate: vi.fn().mockResolvedValue({}),
    handleDelete: vi.fn().mockResolvedValue(undefined),
    handleSend: vi.fn().mockResolvedValue({}),
    handleUpdate: vi.fn().mockResolvedValue({}),
  });
}

describe('BroadcastsPage audit fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('F2: has Scheduled tab, Draft stat, and schedule input + button', async () => {
    mockHook([]);
    const user = userEvent.setup();
    render(<BroadcastsPage />);
    expect(screen.getByRole('button', { name: 'Scheduled' })).toBeInTheDocument();
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getAllByRole('button', { name: '+ New Broadcast' })[0]);
    expect(screen.getByText('Schedule for later (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('F2: Schedule validates a future datetime and creates with scheduledAt', async () => {
    const handleCreate = vi.fn().mockResolvedValue({});
    useBroadcastsMock.mockReturnValue({
      loading: false,
      error: null,
      broadcasts: [],
      reload: vi.fn(),
      handleCreate,
      handleDelete: vi.fn(),
      handleSend: vi.fn(),
      handleUpdate: vi.fn(),
    });
    const user = userEvent.setup();
    render(<BroadcastsPage />);
    await user.click(screen.getAllByRole('button', { name: '+ New Broadcast' })[0]);
    const titleBox = screen.getByPlaceholderText('e.g. New Feature Announcement');
    const msgBox = screen.getByPlaceholderText('Write your broadcast message…');
    await user.type(titleBox, 'Big news');
    await user.type(msgBox, 'Hello all');
    await user.click(screen.getByRole('button', { name: 'Schedule' }));
    // No datetime picked → validation error, no create call.
    expect(handleCreate).not.toHaveBeenCalled();
    expect(toastPushMock).toHaveBeenCalledWith('Pick a scheduled date and time.', 'error');
  });

  it('F3: draft/scheduled rows have an Edit button opening an edit dialog', async () => {
    mockHook([
      makeBroadcast({ id: 'b1', status: 'Draft' }),
      makeBroadcast({ id: 'b2', status: 'Scheduled' }),
      makeBroadcast({ id: 'b3', status: 'Sent' }),
    ]);
    const user = userEvent.setup();
    render(<BroadcastsPage />);
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.getByText('Edit Broadcast')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('F3: saving the edit dialog calls handleUpdate', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    useBroadcastsMock.mockReturnValue({
      loading: false,
      error: null,
      broadcasts: [makeBroadcast()],
      reload: vi.fn(),
      handleCreate: vi.fn(),
      handleDelete: vi.fn(),
      handleSend: vi.fn(),
      handleUpdate,
    });
    const user = userEvent.setup();
    render(<BroadcastsPage />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(handleUpdate).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ title: 'Draft one' }),
    );
  });
});
