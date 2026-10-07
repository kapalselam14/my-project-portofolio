/** Forward-geocoding autocomplete backed by OpenStreetMap's Nominatim service. */

export type PlaceSuggestion = {
  placeId: string;
  /** Primary line, e.g. "Auckland Domain". */
  label: string;
  /** Secondary line, e.g. "Epsom, Auckland". */
  secondary: string;
  latitude: number;
  longitude: number;
};

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 5 * 60 * 1000;
// Room for a full suggestion sheet: the mobile list comfortably fits ~12 rows and users complained 6 hid nearby.
const MAX_RESULTS = 15;
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 100;

/** Auckland-biased search window (`left,top,right,bottom` degrees). */
export type Viewbox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

interface CacheEntry {
  at: number;
  value: PlaceSuggestion[];
}

/** Tiny in-memory cache — plenty for a single-instance dev/demo server. */
const cache = new Map<string, CacheEntry>();

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

interface NominatimPlace {
  place_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  address?: Record<string, string | undefined>;
}

/** Splits a Nominatim `display_name` into a primary label and secondary detail. */
function splitDisplayName(displayName: string): { label: string; secondary: string } {
  const comma = displayName.indexOf(',');

  if (comma === -1) {
    return { label: displayName, secondary: '' };
  }

  return {
    label: displayName.slice(0, comma).trim(),
    secondary: displayName.slice(comma + 1).trim(),
  };
}

export async function autocompletePlaces(
  query: string,
  countryCodes?: string,
  viewbox?: Viewbox,
): Promise<PlaceSuggestion[]> {
  const normalized = normalizeQuery(query);

  if (normalized.length < MIN_QUERY_LENGTH || normalized.length > MAX_QUERY_LENGTH) {
    return [];
  }

  if (countryCodes !== undefined && !/^[A-Za-z]{2}(,[A-Za-z]{2})*$/.test(countryCodes)) {
    throw new Error('countryCodes must be a comma-separated list of ISO 3166-1 alpha-2 codes');
  }

  const viewboxKey =
    viewbox !== undefined
      ? `${viewbox.left},${viewbox.top},${viewbox.right},${viewbox.bottom}`
      : '*';
  const cacheKey = `${countryCodes ?? '*'}|${viewboxKey}|${normalized.toLowerCase()}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('q', normalized);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('addressdetails', '1');

  if (countryCodes) {
    url.searchParams.set('countrycodes', countryCodes);
  }

  if (viewbox !== undefined) {
    // Bias (not restrict): Auckland matches rank first, world matches still appear below instead of vanishing.
    url.searchParams.set(
      'viewbox',
      `${viewbox.left},${viewbox.top},${viewbox.right},${viewbox.bottom}`,
    );
    url.searchParams.set('bounded', '0');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Nominatim usage policy requires an identifying UA.
        'User-Agent': 'matchup-demo/1.0 (university project)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Places provider unavailable (HTTP ${response.status})`);
    }

    const body: unknown = await response.json();

    if (!Array.isArray(body)) {
      throw new Error('Places provider returned an unexpected payload');
    }

    const suggestions: PlaceSuggestion[] = [];

    for (const raw of body) {
      if (typeof raw !== 'object' || raw === null) continue;
      const place = raw as NominatimPlace;
      const lat = Number(place.lat);
      const lon = Number(place.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const displayName = typeof place.display_name === 'string' ? place.display_name : '';

      if (!displayName) continue;

      const { label, secondary } = splitDisplayName(displayName);

      suggestions.push({
        placeId: String(place.place_id ?? `${lat},${lon}`),
        label,
        secondary,
        latitude: lat,
        longitude: lon,
      });
    }

    cache.set(cacheKey, { at: Date.now(), value: suggestions });
    return suggestions;
  } finally {
    clearTimeout(timeout);
  }
}
