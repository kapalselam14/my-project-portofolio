import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  /** Length of the fixed window in milliseconds. */
  windowMs: number;
  /** Max requests allowed per window, per IP. */
  max: number;
  /** Message returned in the 429 envelope. */
  message?: string;
  /** Return true to exempt a request (e.g. health checks). */
  skip?: (req: Request) => boolean;
}

interface WindowCounter {
  count: number;
  resetAt: number;
}

/** Counter backend for the fixed-window limiter. */
export interface RateLimitStore {
  /** Atomically increments the window for `key`, returning the new state. */
  hit(key: string, now: number, windowMs: number): WindowCounter;
  /** Drops expired windows; called opportunistically, never on the hot path contract. */
  sweep(now: number): void;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, WindowCounter>();

  hit(key: string, now: number, windowMs: number): WindowCounter {
    const existing = this.hits.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  sweep(now: number): void {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) {
        this.hits.delete(key);
      }
    }
  }
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

/** Per-IP fixed-window limiter. */
export function createRateLimiter(options: RateLimitOptions & { store?: RateLimitStore }) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please slow down.',
    skip,
    store = new MemoryRateLimitStore(),
  } = options;

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    if (skip?.(req)) {
      next();
      return;
    }

    const now = Date.now();

    // Drop expired windows so one-off scanner IPs cannot grow the store.
    store.sweep(now);

    const key = clientIp(req);
    const { count, resetAt } = store.hit(key, now, windowMs);

    const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
    res.set('RateLimit-Limit', String(max));
    res.set('RateLimit-Remaining', String(Math.max(0, max - count)));
    res.set('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      res.set('Retry-After', String(retryAfterSec));
      res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message,
        },
      });
      return;
    }

    next();
  };
}

/** Global default: 1200 req / 15 min per IP. Health checks are skipped so load-balancer probes are never throttled. */
export const GLOBAL_RATE_LIMIT: RateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 1200,
  skip: (req) => req.path === '/api/health',
};

/** Places proxy: 60 req/min per IP matches the upstream ~1 req/s policy. */
export const AUTOCOMPLETE_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many place searches, please slow down.',
};

/** Typing poll burst guard: 120 req/min per IP across roster members. */
export const TYPING_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60 * 1000,
  max: 120,
  message: 'Too many typing requests, please slow down.',
};
