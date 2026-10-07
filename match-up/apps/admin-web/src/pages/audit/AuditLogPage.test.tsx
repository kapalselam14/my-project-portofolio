import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useAuditLogMock, useThemeMock, toastPushMock, downloadCsvMock } = vi.hoisted(() => ({
  useAuditLogMock: vi.fn(),
  useThemeMock: vi.fn(),
  toastPushMock: vi.fn(),
  downloadCsvMock: vi.fn(),
}));

vi.mock('../../hooks/useAuditLog', () => ({ useAuditLog: useAuditLogMock }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: useThemeMock }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: toastPushMock }) }));
vi.mock('../../utils/csvExport', () => ({ downloadCsv: downloadCsvMock }));

import { AuditLogPage } from './AuditLogPage';
import type { AuditLogEntry } from '../../services/auditLogService';

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'e1',
    category: 'Members',
    action: 'member.status_change',
    adminUid: 'admin-1',
    adminEmail: 'admin@x.com',
    description: 'Set member status to suspended',
    targetId: 'u-1',
    targetLabel: 'alice@x.com',
    before: { status: 'active' },
    after: { status: 'suspended' },
    metadata: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useThemeMock.mockReturnValue({ theme: 'light', toggle: vi.fn() });
  });

  it('shows a skeleton while loading', () => {
    useAuditLogMock.mockReturnValue({ loading: true, error: null, entries: [], reload: vi.fn() });
    const { container } = render(<AuditLogPage />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    const reload = vi.fn();
    useAuditLogMock.mockReturnValue({ loading: false, error: 'network down', entries: [], reload });
    const user = userEvent.setup();
    render(<AuditLogPage />);

    expect(screen.getByText('Failed to load: network down')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders entries with description, category, admin, and target', () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [makeEntry()],
      reload: vi.fn(),
    });
    const { container } = render(<AuditLogPage />);
    const list = within(container.querySelector('.divide-y')!);

    expect(list.getByText('Set member status to suspended')).toBeInTheDocument();
    expect(list.getByText('Members')).toBeInTheDocument();
    expect(list.getByText('admin@x.com')).toBeInTheDocument();
    expect(list.getByText('alice@x.com')).toBeInTheDocument();
  });

  it('falls back to adminUid when adminEmail is null', () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [makeEntry({ adminEmail: null })],
      reload: vi.fn(),
    });
    render(<AuditLogPage />);
    expect(screen.getByText('admin-1')).toBeInTheDocument();
  });

  it('computes the Total Actions and Admins Active stat cards', () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        makeEntry({ id: 'e1', adminUid: 'admin-1' }),
        makeEntry({ id: 'e2', adminUid: 'admin-2' }),
        makeEntry({ id: 'e3', adminUid: 'admin-1' }),
      ],
      reload: vi.fn(),
    });
    render(<AuditLogPage />);

    const totalCard = screen.getByText('Total Actions').closest('div')!;
    expect(within(totalCard).getByText('3')).toBeInTheDocument();
    const adminsCard = screen.getByText('Admins Active').closest('div')!;
    expect(within(adminsCard).getByText('2')).toBeInTheDocument();
  });

  it('filters entries by category', async () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        makeEntry({ id: 'e1', category: 'Members', description: 'Member action' }),
        makeEntry({ id: 'e2', category: 'Sports', description: 'Sports action' }),
      ],
      reload: vi.fn(),
    });
    const user = userEvent.setup();
    const { container } = render(<AuditLogPage />);
    const list = () => within(container.querySelector('.divide-y')!);

    expect(list().getByText('Member action')).toBeInTheDocument();
    expect(list().getByText('Sports action')).toBeInTheDocument();

    // Two "Sports" buttons exist (filter tab + sidebar breakdown) — the filter tab is the first one in DOM order.
    await user.click(screen.getAllByRole('button', { name: 'Sports' })[0]);

    expect(list().queryByText('Member action')).not.toBeInTheDocument();
    expect(list().getByText('Sports action')).toBeInTheDocument();
  });

  it('filters entries by search text', async () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [
        makeEntry({ id: 'e1', description: 'Suspended alice', targetLabel: 'alice@x.com' }),
        makeEntry({ id: 'e2', description: 'Deleted bob', targetLabel: 'bob@x.com' }),
      ],
      reload: vi.fn(),
    });
    const user = userEvent.setup();
    const { container } = render(<AuditLogPage />);
    const list = () => within(container.querySelector('.divide-y')!);

    await user.type(screen.getByPlaceholderText('Search actions…'), 'bob');

    // "Recent Activity" in the sidebar is intentionally unfiltered.
    expect(list().queryByText('Suspended alice')).not.toBeInTheDocument();
    expect(list().getByText('Deleted bob')).toBeInTheDocument();
  });

  it('shows the empty state when no entries match the filters', async () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [makeEntry({ description: 'Suspended alice' })],
      reload: vi.fn(),
    });
    const user = userEvent.setup();
    render(<AuditLogPage />);

    await user.type(screen.getByPlaceholderText('Search actions…'), 'nonexistent');
    expect(screen.getByText('No log entries found.')).toBeInTheDocument();
  });

  it('paginates beyond the first 10 entries', async () => {
    const entries = Array.from({ length: 11 }, (_, i) =>
      makeEntry({ id: `e${i}`, description: `Action ${i}` }),
    );
    useAuditLogMock.mockReturnValue({ loading: false, error: null, entries, reload: vi.fn() });
    const user = userEvent.setup();
    const { container } = render(<AuditLogPage />);
    const list = () => within(container.querySelector('.divide-y')!);

    expect(list().getByText('Action 0')).toBeInTheDocument();
    expect(list().queryByText('Action 10')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(list().getByText('Action 10')).toBeInTheDocument();
  });

  it('expands a row with details to show before/after state', async () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [makeEntry()],
      reload: vi.fn(),
    });
    const user = userEvent.setup();
    const { container } = render(<AuditLogPage />);
    const list = within(container.querySelector('.divide-y')!);

    await user.click(list.getByText('Set member status to suspended'));
    expect(list.getByText('active')).toBeInTheDocument();
    expect(list.getByText('suspended')).toBeInTheDocument();
  });

  it('exports entries as CSV and shows a toast', async () => {
    useAuditLogMock.mockReturnValue({
      loading: false,
      error: null,
      entries: [makeEntry()],
      reload: vi.fn(),
    });
    const user = userEvent.setup();
    render(<AuditLogPage />);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadCsvMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ ID: 'e1' })]),
      'matchup-audit-log.csv',
    );
    expect(toastPushMock).toHaveBeenCalledWith('Audit log exported as CSV.', 'info');
  });
});
