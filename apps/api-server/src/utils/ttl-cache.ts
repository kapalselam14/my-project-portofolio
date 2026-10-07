/** Minimal keyed TTL cache with in-flight de-dup. */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();
  private readonly pending = new Map<string, Promise<T>>();

  /** @param ttlMs how long a filled value stays fresh. */
  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('ttlMs must be a positive number');
    }
  }

  async getOrFill(key: string, fill: () => Promise<T>): Promise<T> {
    const at = this.now();
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > at) return hit.value;

    const flight = this.pending.get(key);
    if (flight) return flight;

    const run = fill().then(
      (value) => {
        this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
        this.pending.delete(key);
        return value;
      },
      (error) => {
        // Never cache failures — the next caller retries the fill.
        this.pending.delete(key);
        throw error;
      },
    );
    this.pending.set(key, run);
    return run;
  }

  /** Drops one key, or the whole cache when `key` is omitted. */
  invalidate(key?: string): void {
    if (key === undefined) {
      this.entries.clear();
      return;
    }
    this.entries.delete(key);
  }
}
