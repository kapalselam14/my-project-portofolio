import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlidePanel } from './SlidePanel';
import React from 'react';

describe('SlidePanel', () => {
  // Cover visibility, close inputs, and keyboard focus behavior expected of a dialog panel.
  it('renders nothing while closed', () => {
    const { container } = render(
      <SlidePanel open={false} onClose={vi.fn()} title="Details">
        Content
      </SlidePanel>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders its title, subtitle, and content when open', () => {
    render(
      <SlidePanel
        open
        onClose={vi.fn()}
        title="Activity details"
        subtitle="Activity 123"
      >
        Content
      </SlidePanel>,
    );

    expect(
      screen.getByRole('dialog', { name: 'Activity details' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Activity 123')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SlidePanel open onClose={onClose} title="Details">
        Content
      </SlidePanel>,
    );

    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <SlidePanel open onClose={onClose} title="Details">
        Content
      </SlidePanel>,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The opener is captured before focus moves into the panel and restored during cleanup.
  it('restores focus to the opener after the panel closes', async () => {
    const user = userEvent.setup();

    function TestPanel() {
      const [open, setOpen] = React.useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open details
          </button>

          <SlidePanel
            open={open}
            onClose={() => setOpen(false)}
            title="Details"
          >
            Content
          </SlidePanel>
        </>
      );
    }

    render(<TestPanel />);

    const opener = screen.getByRole('button', { name: 'Open details' });

    await user.click(opener);
    expect(screen.getByRole('button', { name: 'Close panel' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(opener).toHaveFocus();
  });

  // Shift+Tab from the first control should wrap to the last focusable panel control.
  it('wraps focus from the close button when Shift+Tab is pressed', async () => {
    const user = userEvent.setup();

    render(
      <SlidePanel open onClose={vi.fn()} title="Details">
        <button type="button">Last action</button>
      </SlidePanel>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close panel' });
    closeButton.focus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');

    expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();
  });
});
