import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useNotifTemplatesMock, toastPushMock } = vi.hoisted(() => ({
  useNotifTemplatesMock: vi.fn(),
  toastPushMock: vi.fn(),
}));
vi.mock('../../hooks/useNotifTemplates', () => ({ useNotifTemplates: useNotifTemplatesMock }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ push: toastPushMock }) }));

import { NotificationTemplatesPage, UNFIRED_TRIGGERS } from './NotificationTemplatesPage';

function makeTemplate(overrides = {}) {
  return {
    id: 't1',
    trigger: 'activity.joined',
    category: 'Activity',
    name: 'Joined',
    description: 'desc',
    title: 'Hi {{userName}}',
    body: 'Welcome {{userName}}',
    variables: ['userName'],
    enabled: true,
    lastEditedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationTemplatesPage audit fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('F5: unfired triggers show an "Inactive trigger" badge', () => {
    useNotifTemplatesMock.mockReturnValue({
      loading: false,
      error: null,
      reload: vi.fn(),
      handleUpdate: vi.fn(),
      handleToggle: vi.fn(),
      templates: [
        makeTemplate({ id: 't1', trigger: 'activity.reminder', name: 'Reminder' }),
        makeTemplate({ id: 't2', trigger: 'activity.joined', name: 'Joined' }),
      ],
    });
    render(<NotificationTemplatesPage />);
    expect(screen.getByText('Inactive trigger')).toBeInTheDocument();
    expect(UNFIRED_TRIGGERS).toContain('activity.reminder');
    expect(UNFIRED_TRIGGERS).toContain('engagement.inactive');
  });

  it('P1: clicking a variable chip inserts at the textarea cursor', async () => {
    useNotifTemplatesMock.mockReturnValue({
      loading: false,
      error: null,
      reload: vi.fn(),
      handleUpdate: vi.fn(),
      handleToggle: vi.fn(),
      templates: [makeTemplate()],
    });
    const user = userEvent.setup();
    render(<NotificationTemplatesPage />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const body = screen.getByDisplayValue('Welcome {{userName}}') as HTMLTextAreaElement;
    body.focus();
    body.setSelectionRange(8, 8); // after "Welcome "
    await user.click(screen.getByTitle('Insert {{userName}}'));
    expect((screen.getByDisplayValue(/Welcome/) as HTMLTextAreaElement).value).toContain(
      'Welcome {{userName}}{{userName}}',
    );
  });
});
