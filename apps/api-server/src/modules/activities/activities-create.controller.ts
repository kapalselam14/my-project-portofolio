import type { Request, Response } from 'express';
import { createActivity } from './activities.service.js';

// Activity creation: validates the wizard payload, persists, notifies followers.

export async function createActivityHandler(req: Request, res: Response) {
  try {
    // Take the host identity from verified auth context, never from the submitted payload.
    const hostId = req.auth?.uid;
    const {
      title,
      sportType,
      description: rawDescription,
      locationName,
      address,
      latitude,
      longitude,
      geohash,
      startTime,
      endTime,
      skillLevel,
      capacity,
      coverImageUrl,
      joinPolicy,
      isPaid,
      fee,
      feeMode,
      totalCost,
      minPlayers,
      weatherTemp,
      weatherCode,
      weatherDesc,
      weatherRain,
    } = req.body as {
      title?: unknown;
      sportType?: unknown;
      description?: unknown;
      locationName?: unknown;
      address?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      geohash?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      skillLevel?: unknown;
      capacity?: unknown;
      coverImageUrl?: unknown;
      joinPolicy?: unknown;
      isPaid?: unknown;
      fee?: unknown;
      feeMode?: unknown;
      totalCost?: unknown;
      minPlayers?: unknown;
      weatherTemp?: unknown;
      weatherCode?: unknown;
      weatherDesc?: unknown;
      weatherRain?: unknown;
    };

    if (!hostId) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (
      typeof title !== 'string' ||
      typeof sportType !== 'string' ||
      typeof locationName !== 'string' ||
      typeof geohash !== 'string' ||
      typeof startTime !== 'string'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message:
            'title, sportType, locationName, geohash, and startTime must be strings',
        },
      });
    }
    if (rawDescription !== undefined && typeof rawDescription !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'description must be a string when provided',
        },
      });
    }
    const description = typeof rawDescription === 'string' ? rawDescription : '';
    if (
      (address !== undefined && typeof address !== 'string') ||
      (endTime !== undefined && typeof endTime !== 'string')
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'address and endTime must be strings when provided',
        },
      });
    }

    if (
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

    if (joinPolicy !== undefined && joinPolicy !== 'open' && joinPolicy !== 'approval') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'joinPolicy must be open or approval',
        },
      });
    }

    if (isPaid !== undefined && typeof isPaid !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'isPaid must be a boolean',
        },
      });
    }

    if (fee !== undefined && (typeof fee !== 'number' || !Number.isFinite(fee) || fee <= 0)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'fee must be a positive number for paid activities',
        },
      });
    }

    if (isPaid === true && fee === undefined) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'fee is required when isPaid is true',
        },
      });
    }

    if (feeMode !== undefined && feeMode !== 'fixed' && feeMode !== 'split') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'feeMode must be fixed or split',
        },
      });
    }

    if (
      totalCost !== undefined &&
      (typeof totalCost !== 'number' || !Number.isFinite(totalCost) || totalCost <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'totalCost must be a positive number for split mode',
        },
      });
    }

    if (
      minPlayers !== undefined &&
      (typeof minPlayers !== 'number' || !Number.isInteger(minPlayers) || minPlayers < 2)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'minPlayers must be an integer >= 2',
        },
      });
    }

    if (feeMode === 'split' && totalCost === undefined) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'totalCost is required when feeMode is split',
        },
      });
    }

    if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'capacity must be a positive integer',
        },
      });
    }

    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'latitude must be a number between -90 and 90',
        },
      });
    }

    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'longitude must be a number between -180 and 180',
        },
      });
    }

    if (
      !title.trim() ||
      !sportType.trim() ||
      !locationName.trim() ||
      !geohash.trim() ||
      !startTime.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message:
            'title, sportType, locationName, geohash, and startTime are required',
        },
      });
    }

    // Build a clean service input and omit optional values the client did not provide.
    const result = await createActivity({
      hostId,
      title,
      sportType,
      description,
      locationName,
      latitude,
      longitude,
      geohash,
      startTime,
      skillLevel,
      capacity,
      ...(typeof address === 'string' ? { address } : {}),
      ...(typeof endTime === 'string' ? { endTime } : {}),
      ...(typeof coverImageUrl === 'string' ? { coverImageUrl } : {}),
      ...(joinPolicy === 'open' || joinPolicy === 'approval' ? { joinPolicy } : {}),
      ...(typeof isPaid === 'boolean' ? { isPaid } : {}),
      ...(typeof fee === 'number' ? { fee } : {}),
      ...(feeMode === 'fixed' || feeMode === 'split' ? { feeMode } : {}),
      ...(typeof totalCost === 'number' ? { totalCost } : {}),
      ...(typeof minPlayers === 'number' ? { minPlayers } : {}),
      ...(typeof weatherTemp === 'number' ? { weatherTemp } : {}),
      ...(typeof weatherCode === 'number' ? { weatherCode } : {}),
      ...(typeof weatherDesc === 'string' ? { weatherDesc } : {}),
      ...(typeof weatherRain === 'number' ? { weatherRain } : {}),
    });

    return res.status(201).json({
      ok: true,
      data: {
        activityId: result.activityId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message === 'isPaid must be a boolean' ||
      message === 'fee must be a positive number for paid activities' ||
      message === 'feeMode must be fixed or split' ||
      message === 'totalCost must be a positive number for split mode' ||
      message === 'minPlayers must be an integer between 2 and capacity'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message,
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}
