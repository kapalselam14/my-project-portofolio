import { describe, expect, it } from 'vitest';

import { geohashCover, geohashEncode, geohashNeighbors, haversineKm } from './geohash.js';

describe('geohash', () => {
  describe('geohashEncode', () => {
    it('encodes the canonical reference point', () => {
      // (42.6, -5.6) at precision 5: my own implementation, not the official geohash.org reference.
      expect(geohashEncode(42.6, -5.6, 5)).toBe('ezs42');
    });

    it('encodes Auckland CBD inside the rck… range', () => {
      expect(geohashEncode(-36.8485, 174.7633, 7)).toMatch(/^rck/);
    });

    it('rejects out-of-range precision', () => {
      expect(() => geohashEncode(0, 0, 0)).toThrow();
      expect(() => geohashEncode(0, 0, 13)).toThrow();
    });
  });

  describe('geohashNeighbors', () => {
    it('returns 9 distinct cells including the center', () => {
      const cells = geohashNeighbors('rckre3y');
      expect(cells).toContain('rckre3y');
      expect(new Set(cells).size).toBe(9);
      for (const cell of cells) {
        expect(cell).toHaveLength(7);
      }
    });
  });

  describe('geohashCover', () => {
    it('picks precision 5 cells for a 10 km radius', () => {
      // Cell size at precision 5 is ~4.9 km wide; a 10 km radius needs at least that precision.
      const cells = geohashCover(-36.8485, 174.7633, 10);
      expect(cells.length).toBe(9);
      for (const cell of cells) {
        expect(cell).toHaveLength(5);
      }
    });

    it('rejects non-positive radius', () => {
      expect(() => geohashCover(0, 0, 0)).toThrow();
    });
  });

  describe('haversineKm', () => {
    it('returns 0 for identical points', () => {
      expect(haversineKm(-36.8485, 174.7633, -36.8485, 174.7633)).toBe(0);
    });

    it('measures Auckland CBD to Eden Park at roughly 3.4 km', () => {
      const d = haversineKm(-36.8485, 174.7633, -36.875, 174.745);
      expect(d).toBeGreaterThan(3);
      expect(d).toBeLessThan(4);
    });
  });
});
