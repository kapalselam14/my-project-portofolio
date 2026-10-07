import type { Request, Response } from 'express';
import {
  attachViewerActivityContext,
  enrichActivityWithHostProfile,
  getActivityById,
  listMyActivities,
  listPublicActivityTeasers,
  listActivities,
} from './activities.service.js';
import { listDiscoverActivities } from './discover.service.js';
import type {
  ActivitySkillLevel,
  ListActivitiesFilters,
  SportSkillFilter,
} from './activities.service.js';

// Activity reads: my lists, discovery feed, search, detail, public teasers.

const LIMIT_VALUE = 20;

type GetActivityParams = {
  activityId: string;
};

export async function listActivitiesHandler(req: Request, res: Response) {
  try {
    // Validate query-string values before converting them into service filters.
    const { status, sportType, skillLevel, limit, mine, offset } = req.query;

    if (
      status !== undefined &&
      status !== 'open' &&
      status !== 'full' &&
      status !== 'cancelled' &&
      status !== 'completed' &&
      status !== 'removed'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be open, full, cancelled, completed, or removed',
        },
      });
    }

    if (
      skillLevel !== undefined &&
      skillLevel !== 'beginner' &&
      skillLevel !== 'intermediate' &&
      skillLevel !== 'advanced' &&
      skillLevel !== 'any'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'skillLevel must be beginner, intermediate, advanced, or any',
        },
      });
    }

    if (sportType !== undefined && typeof sportType !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'sportType must be a string',
        },
      });
    }

    if (sportType !== undefined && !sportType.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'sportType is required when provided',
        },
      });
    }

    if (limit !== undefined && typeof limit !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'limit must be an integer between 1 and 50',
        },
      });
    }

    const parsedLimit = limit === undefined ? LIMIT_VALUE : Number(limit);

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 50) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'limit must be an integer between 1 and 50',
        },
      });
    }

    if (mine !== undefined && mine !== 'hosted' && mine !== 'joined') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'mine must be hosted or joined',
        },
      });
    }

    const parsedOffset = offset === undefined ? 0 : Number(offset);
    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'offset must be a non-negative integer',
        },
      });
    }

    const viewerUid = req.auth?.uid;
    if (!viewerUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    // `?mine=hosted|joined` — paginated My Games reads.
    if (mine === 'hosted' || mine === 'joined') {
      const activities = await listMyActivities(viewerUid, mine, parsedLimit, parsedOffset);
      const data = await Promise.all(
        activities.map((activity) => attachViewerActivityContext(activity, viewerUid)),
      );
      return res.status(200).json({ ok: true, data });
    }

    // `discover=1` opts the feed into the ranked discovery pipeline (sport/skill + date + geo + swipe-exclude).
    if (req.query.discover === '1') {
      const discover = parseDiscoverQuery(req);
      if ('error' in discover) {
        return res.status(400).json({
          ok: false,
          error: discover.error,
        });
      }
      const ranked = await listDiscoverActivities({
        limit: parsedLimit,
        viewerUid,
        discover: discover.filters,
      });
      const data = await Promise.all(
        ranked.map(async (activity) =>
          attachViewerActivityContext(await enrichActivityWithHostProfile(activity), viewerUid),
        ),
      );
      return res.status(200).json({ ok: true, data });
    }

    const activities = await listActivities({
      status: status === undefined ? 'open' : status,
      ...(sportType !== undefined ? { sportType } : {}),
      ...(skillLevel !== undefined ? { skillLevel } : {}),
      limit: parsedLimit,
    });

    const data = await Promise.all(
      activities.map((activity) => attachViewerActivityContext(activity, viewerUid)),
    );

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}

/** Parse the `?discover=1` query into a typed filter. */
function parseDiscoverQuery(
  req: Request,
):
  | { filters: NonNullable<ListActivitiesFilters['discover']> }
  | { error: { code: string; message: string } } {
  const { nearLat, nearLng, radiusKm, startAfter, startBefore, sportFilters, excludeActivityIds } =
    req.query;

  const discover: NonNullable<ListActivitiesFilters['discover']> = {
    sportFilters: [],
  };

  if (nearLat !== undefined || nearLng !== undefined || radiusKm !== undefined) {
    if (
      typeof nearLat !== 'string' ||
      typeof nearLng !== 'string' ||
      typeof radiusKm !== 'string'
    ) {
      return {
        error: {
          code: 'INVALID_INPUT',
          message: 'nearLat, nearLng, and radiusKm must all be provided together',
        },
      };
    }
    const lat = Number(nearLat);
    const lng = Number(nearLng);
    const rad = Number(radiusKm);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(rad) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      rad <= 0 ||
      rad > 5000
    ) {
      return {
        error: {
          code: 'INVALID_INPUT',
          message: 'nearLat must be in [-90,90], nearLng in [-180,180], radiusKm in (0,5000]',
        },
      };
    }
    discover.near = { latitude: lat, longitude: lng, radiusKm: rad };
  }

  if (startAfter !== undefined) {
    if (typeof startAfter !== 'string' || Number.isNaN(Date.parse(startAfter))) {
      return { error: { code: 'INVALID_INPUT', message: 'startAfter must be an ISO date string' } };
    }
    discover.startAfter = startAfter;
  }

  if (startBefore !== undefined) {
    if (typeof startBefore !== 'string' || Number.isNaN(Date.parse(startBefore))) {
      return {
        error: { code: 'INVALID_INPUT', message: 'startBefore must be an ISO date string' },
      };
    }
    discover.startBefore = startBefore;
  }

  if (sportFilters !== undefined) {
    if (typeof sportFilters !== 'string' || sportFilters.trim() === '') {
      discover.sportFilters = [];
    } else {
      const parsed: SportSkillFilter[] = [];
      for (const part of sportFilters.split(',')) {
        const trimmed = part.trim();
        if (trimmed === '') continue;
        const colon = trimmed.indexOf(':');
        if (colon <= 0 || colon === trimmed.length - 1) {
          return {
            error: {
              code: 'INVALID_INPUT',
              message: 'sportFilters entries must be Sport:skill',
            },
          };
        }
        const sport = trimmed.slice(0, colon).trim();
        const skill = trimmed.slice(colon + 1).trim() as ActivitySkillLevel | 'any';
        if (
          skill !== 'any' &&
          skill !== 'beginner' &&
          skill !== 'intermediate' &&
          skill !== 'advanced'
        ) {
          return {
            error: {
              code: 'INVALID_INPUT',
              message: `sportFilters skill must be any/beginner/intermediate/advanced (got ${skill})`,
            },
          };
        }
        parsed.push({ sport, skill });
      }
      discover.sportFilters = parsed;
    }
  }

  if (excludeActivityIds !== undefined) {
    if (typeof excludeActivityIds !== 'string') {
      return {
        error: {
          code: 'INVALID_INPUT',
          message: 'excludeActivityIds must be a comma-separated string',
        },
      };
    }
    discover.excludeActivityIds = excludeActivityIds
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const { includeSwiped } = req.query;
  if (includeSwiped !== undefined) {
    if (includeSwiped !== 'true' && includeSwiped !== 'false') {
      return {
        error: {
          code: 'INVALID_INPUT',
          message: 'includeSwiped must be true or false',
        },
      };
    }
    discover.includeSwiped = includeSwiped === 'true';
  }

  return { filters: discover };
}

export async function listPublicActivityTeasersHandler(req: Request, res: Response) {
  try {
    const { limit } = req.query;

    if (limit !== undefined && typeof limit !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'limit must be an integer between 1 and 20',
        },
      });
    }

    const parsedLimit = limit === undefined ? 10 : Number(limit);

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 20) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'limit must be an integer between 1 and 20',
        },
      });
    }

    const activities = await listPublicActivityTeasers(parsedLimit);

    return res.status(200).json({
      ok: true,
      data: activities,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}

/** Great-circle distance in kilometres between two lat/lng points. Pure — unit-testable without Firestore. */
export function haversineKm(latA: number, lngA: number, latB: number, lngB: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(a));
}

const SEARCH_LIMIT = 50;

/** `GET /api/activities/search?sport=&skill=&max_km=&lat=&lng=` — filtered discovery over the existing `open` feed. */
export async function searchActivitiesHandler(req: Request, res: Response) {
  try {
    const viewerUid = req.auth?.uid;
    if (!viewerUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    // Shapes pre-checked by `validateQuery(searchActivitiesQuerySchema)` (enums, numeric strings).
    const { sport, skill, max_km, lat, lng } = req.query as {
      sport?: unknown;
      skill?: unknown;
      max_km?: unknown;
      lat?: unknown;
      lng?: unknown;
    };

    if (
      skill !== undefined &&
      skill !== 'beginner' &&
      skill !== 'intermediate' &&
      skill !== 'advanced' &&
      skill !== 'any'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'skill must be beginner, intermediate, advanced, or any',
        },
      });
    }

    let center: { latitude: number; longitude: number; radiusKm: number } | undefined;
    if (lat !== undefined || lng !== undefined || max_km !== undefined) {
      if (typeof lat !== 'string' || typeof lng !== 'string' || typeof max_km !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'lat, lng, and max_km must be provided together as strings',
          },
        });
      }
      const latitude = Number(lat);
      const longitude = Number(lng);
      const radiusKm = Number(max_km);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(radiusKm) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        radiusKm <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'lat must be in [-90,90], lng in [-180,180], max_km must be positive',
          },
        });
      }
      center = { latitude, longitude, radiusKm };
    }

    const activities = await listActivities({
      status: 'open',
      ...(typeof sport === 'string' && sport.trim() ? { sportType: sport.trim() } : {}),
      ...(skill === 'beginner' ||
      skill === 'intermediate' ||
      skill === 'advanced' ||
      skill === 'any'
        ? { skillLevel: skill }
        : {}),
      limit: SEARCH_LIMIT,
    });

    const filtered = center
      ? activities.filter((a) => {
          if (typeof a.latitude !== 'number' || typeof a.longitude !== 'number') return false;
          return (
            haversineKm(center.latitude, center.longitude, a.latitude, a.longitude) <=
            center.radiusKm
          );
        })
      : activities;

    const data = await Promise.all(
      filtered.map((activity) => attachViewerActivityContext(activity, viewerUid)),
    );

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function getActivityHandler(req: Request<GetActivityParams>, res: Response) {
  try {
    const { activityId } = req.params;

    if (!activityId.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    }

    const activity = await getActivityById(activityId);

    if (!activity) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
    }

    const viewerUid = req.auth?.uid;

    if (!viewerUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    const data = await attachViewerActivityContext(activity, viewerUid);

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}
