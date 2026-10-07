/** Minimal geohash utilities for proximity filtering. */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Interleave longitude and latitude bits into a compact base32 geographic cell key. */
export function geohashEncode(latitude: number, longitude: number, precision: number): string {
  if (!Number.isInteger(precision) || precision < 1 || precision > 12) {
    throw new Error('precision must be an integer between 1 and 12');
  }

  let latLow = -90;
  let latHigh = 90;
  let lonLow = -180;
  let lonHigh = 180;

  let buffer = '';
  let bits = 0;
  let bit = 0;
  let even = true;

  while (buffer.length < precision) {
    if (even) {
      const mid = (lonLow + lonHigh) / 2;
      if (longitude >= mid) {
        bits = (bits << 1) | 1;
        lonLow = mid;
      } else {
        bits = bits << 1;
        lonHigh = mid;
      }
    } else {
      const mid = (latLow + latHigh) / 2;
      if (latitude >= mid) {
        bits = (bits << 1) | 1;
        latLow = mid;
      } else {
        bits = bits << 1;
        latHigh = mid;
      }
    }

    even = !even;
    bit += 1;

    if (bit === 5) {
      buffer += BASE32[bits & 0x1f];
      bits = 0;
      bit = 0;
    }
  }

  return buffer;
}

/** Return the eight adjacent cells by decoding the center and stepping one cell in each direction. */
export function geohashNeighbors(hash: string): string[] {
  const { latitude, longitude, latHeight, lonWidth } = decodeBbox(hash);
  const precision = hash.length;
  const result = new Set<string>();

  for (const dLat of [-1, 0, 1]) {
    for (const dLon of [-1, 0, 1]) {
      const lat = latitude + dLat * latHeight;
      const lon = longitude + dLon * lonWidth;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      result.add(geohashEncode(lat, lon, precision));
    }
  }

  return [...result];
}

/** Cover a search radius with cells, deduplicating overlap between neighboring cell sets. */
export function geohashCover(latitude: number, longitude: number, radiusKm: number): string[] {
  if (!(radiusKm > 0) || radiusKm > 5000) {
    throw new Error('radiusKm must be a number between 0 and 5000');
  }

  // Pick the coarsest precision whose cell still comfortably covers the requested radius.
  const precision =
    radiusKm > 2500
      ? 1
      : radiusKm > 630
        ? 2
        : radiusKm > 78
          ? 3
          : radiusKm > 20
            ? 4
            : radiusKm > 2.4
              ? 5
              : radiusKm > 0.61
                ? 6
                : 7;

  const center = geohashEncode(latitude, longitude, precision);
  return geohashNeighbors(center);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function decodeBbox(hash: string): {
  latitude: number;
  longitude: number;
  latHeight: number;
  lonWidth: number;
} {
  let latLow = -90;
  let latHigh = 90;
  let lonLow = -180;
  let lonHigh = 180;
  let even = true;

  for (const char of hash) {
    const value = BASE32.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid geohash character: ${char}`);
    }
    for (let mask = 16; mask > 0; mask >>= 1) {
      if (even) {
        const mid = (lonLow + lonHigh) / 2;
        if (value & mask) lonLow = mid;
        else lonHigh = mid;
      } else {
        const mid = (latLow + latHigh) / 2;
        if (value & mask) latLow = mid;
        else latHigh = mid;
      }
      even = !even;
    }
  }

  return {
    latitude: (latLow + latHigh) / 2,
    longitude: (lonLow + lonHigh) / 2,
    latHeight: latHigh - latLow,
    lonWidth: lonHigh - lonLow,
  };
}
