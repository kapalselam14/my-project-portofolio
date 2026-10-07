import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// `globals: false` in vite.config.ts means Testing Library's automatic afterEach cleanup.
afterEach(() => {
  cleanup();
});

// Node 22+ ships global web-storage objects that shadow jsdom's real Storage under vitest.
class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const current = (globalThis as Record<string, unknown>)[name] as Storage | null | undefined;
  const usable =
    current != null &&
    typeof current.clear === 'function' &&
    typeof current.getItem === 'function' &&
    typeof current.setItem === 'function' &&
    typeof current.removeItem === 'function';
  if (!usable) {
    Object.defineProperty(globalThis, name, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
