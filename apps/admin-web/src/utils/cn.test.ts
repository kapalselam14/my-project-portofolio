// Tests for cn.
import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins plain class name strings with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values (false, null, undefined, empty string)', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('keeps only the truthy keys of a conditional object', () => {
    expect(cn({ a: true, b: false, c: true })).toBe('a c');
  });

  it('flattens arrays of class values', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('returns an empty string when given nothing usable', () => {
    expect(cn()).toBe('');
    expect(cn(false, null, undefined)).toBe('');
  });
});
