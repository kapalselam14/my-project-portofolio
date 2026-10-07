import type { Request, Response } from 'express';
import { autocompletePlaces, type Viewbox } from './places.service.js';

function parseViewbox(raw: unknown): Viewbox | undefined {
  // Convert the comma-separated query value into a validated geographic rectangle.
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw new Error('viewbox must be "left,top,right,bottom" in degrees');
  }
  const parts = raw.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error('viewbox must be "left,top,right,bottom" in degrees');
  }
  const [left, top, right, bottom] = parts as [number, number, number, number];
  if (
    left < -180 ||
    right > 180 ||
    bottom < -90 ||
    top > 90 ||
    !(left < right) ||
    !(bottom < top)
  ) {
    throw new Error('viewbox must be "left,top,right,bottom" in degrees');
  }
  return { left, top, right, bottom };
}

/** Public autocomplete endpoint with optional country and geographic filters. */
export async function autocompletePlacesHandler(req: Request, res: Response) {
  try {
    const { q, countryCodes, viewbox: viewboxRaw } = req.query;

    if (typeof q !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'q must be a string',
        },
      });
    }

    if (countryCodes !== undefined && typeof countryCodes !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'countryCodes must be a string',
        },
      });
    }

    let viewbox: Viewbox | undefined;
    try {
      viewbox = parseViewbox(viewboxRaw);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: error instanceof Error ? error.message : 'Invalid viewbox',
        },
      });
    }

    const suggestions = await autocompletePlaces(q, countryCodes, viewbox);

    return res.status(200).json({
      ok: true,
      data: suggestions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'countryCodes must be a comma-separated list of ISO 3166-1 alpha-2 codes') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message,
        },
      });
    }

    return res.status(502).json({
      ok: false,
      error: {
        code: 'PLACES_UNAVAILABLE',
        message: 'Could not reach the places provider. Please try again.',
      },
    });
  }
}
