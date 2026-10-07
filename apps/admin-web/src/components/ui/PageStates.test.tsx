// Tests for PageStates.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, PageError, Skeleton } from './PageStates';

describe('Skeleton', () => {
  // Check that callers can size a placeholder without losing the shared loading animation.
  it('applies the given className alongside the pulse styling', () => {
    const { container } = render(<Skeleton className="h-4 w-10" />);
    expect(container.firstChild).toHaveClass('animate-pulse', 'h-4', 'w-10');
  });
});

describe('PageError', () => {
  // Verify the failure message and that retry delegates to the page's reload callback.
  it('shows the failure message', () => {
    render(<PageError message="network down" onRetry={vi.fn()} />);
    expect(screen.getByText('Failed to load: network down')).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<PageError message="oops" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  // Cover the minimal empty state as well as optional description and action content.
  it('renders the title without optional description, icon, or action', () => {
    render(<EmptyState title="No members yet" />);
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the description when given', () => {
    render(<EmptyState title="No results" description="Try a different filter." />);
    expect(screen.getByText('Try a different filter.')).toBeInTheDocument();
  });

  it('renders an action button and fires its onClick handler', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<EmptyState title="No broadcasts" action={{ label: 'New broadcast', onClick }} />);

    const button = screen.getByRole('button', { name: 'New broadcast' });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
