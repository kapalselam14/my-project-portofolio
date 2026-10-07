// Tests for Avatar.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  // Cover photo rendering, initials fallbacks, and repeatable colors from the same seed.
  it('renders an img with the given photoUrl and alt text', () => {
    render(<Avatar name="Alice Smith" photoUrl="https://example.com/a.png" />);
    const img = screen.getByRole('img', { name: 'Alice Smith' });
    expect(img).toHaveAttribute('src', 'https://example.com/a.png');
  });

  it('falls back to two-letter initials from first and last name', () => {
    render(<Avatar name="Alice Smith" />);
    expect(screen.getByLabelText('Alice Smith')).toHaveTextContent('AS');
  });

  it('uses the first two letters of a single-word name', () => {
    render(<Avatar name="Cher" />);
    expect(screen.getByLabelText('Cher')).toHaveTextContent('CH');
  });

  it('renders a "?" placeholder for a blank name', () => {
    const { container } = render(<Avatar name="   " />);
    expect(container.firstChild).toHaveTextContent('?');
  });

  it('produces the same background color for the same seed', () => {
    const { container: c1 } = render(<Avatar name="Alice" seed="fixed-seed" />);
    const { container: c2 } = render(<Avatar name="Bob" seed="fixed-seed" />);
    const style1 = (c1.firstChild as HTMLElement).getAttribute('style');
    const style2 = (c2.firstChild as HTMLElement).getAttribute('style');
    expect(style1).toBe(style2);
  });

  it('falls back to using the name as the color seed when none is given', () => {
    const { container: c1 } = render(<Avatar name="Same Name" />);
    const { container: c2 } = render(<Avatar name="Same Name" />);
    expect((c1.firstChild as HTMLElement).getAttribute('style')).toBe(
      (c2.firstChild as HTMLElement).getAttribute('style'),
    );
  });
});
