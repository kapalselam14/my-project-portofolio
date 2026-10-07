// Tests for ConfirmDialog.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  // Cover closed/open rendering, customizable labels, and both action callbacks.
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Remove member" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title, optional description, and default button labels when open', () => {
    render(
      <ConfirmDialog
        open
        title="Remove member"
        description="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Remove member')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('uses custom confirm/cancel labels when provided', () => {
    render(
      <ConfirmDialog
        open
        title="Suspend"
        confirmLabel="Suspend"
        cancelLabel="Never mind"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Never mind' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Remove" onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Remove" onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
