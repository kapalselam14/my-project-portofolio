// ratings.controller (ratings).
import type { Request, Response } from 'express';
import { hasUserRated, submitActivityRating } from './ratings.service.js';

type ActivityRatingsParams = {
  activityId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function submitActivityRatingHandler(
  req: Request<ActivityRatingsParams>,
  res: Response,
) {
  try {
    const raterUid = req.auth?.uid;
    const { activityId } = req.params;
    const { sportType, comment, participantRatings, activityStars } = (req.body ?? {}) as {
      sportType?: unknown;
      comment?: unknown;
      participantRatings?: unknown;
      activityStars?: unknown;
    };

    if (!raterUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (!activityId.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
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

    if (comment !== undefined && typeof comment !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'comment must be a string',
        },
      });
    }

    if (!Array.isArray(participantRatings)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'participantRatings must be an array',
        },
      });
    }

    if (
      activityStars !== undefined &&
      (typeof activityStars !== 'number' ||
        !Number.isInteger(activityStars) ||
        activityStars < 1 ||
        activityStars > 5)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid rating for activity: stars must be an integer between 1 and 5',
        },
      });
    }

    // Check object shape before mapping; the service then validates stars and activity membership.
    for (const entry of participantRatings) {
      if (!isRecord(entry) || typeof entry.rateeUid !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'each participant rating must include a rateeUid string',
          },
        });
      }
    }

    const result = await submitActivityRating({
      activityId,
      raterUid,
      ...(typeof sportType === 'string' && sportType.trim() ? { sportType: sportType.trim() } : {}),
      ...(typeof comment === 'string' && comment.trim() ? { comment: comment.trim() } : {}),
      ...(typeof activityStars === 'number' ? { activityStars } : {}),
      participantRatings: participantRatings.map((entry) => ({
        rateeUid: (entry as Record<string, unknown>).rateeUid as string,
        stars: (entry as Record<string, unknown>).stars as number,
      })),
    });

    return res.status(200).json({
      ok: true,
      data: {
        activityId,
        raterUid,
        updated: result.updated,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }

    if (message === 'Only the host or participants can rate this activity') {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message },
      });
    }

    if (
      message === 'Activity must be completed before it can be rated' ||
      message === 'Rating window has closed for this activity'
    ) {
      return res.status(409).json({
        ok: false,
        error: { code: 'CONFLICT', message },
      });
    }

    if (
      message === 'activityId is required' ||
      message === 'raterUid is required' ||
      message === 'participantRatings must be an array' ||
      message === 'sportType is required' ||
      message.startsWith('Invalid rating for') ||
      message.startsWith('Each participant rating') ||
      message === 'You cannot rate yourself' ||
      message.endsWith('did not take part in this activity')
    ) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message },
      });
    }

    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function getMyRatingHandler(req: Request<ActivityRatingsParams>, res: Response) {
  try {
    const raterUid = req.auth?.uid;
    const { activityId } = req.params;

    if (!raterUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (!activityId.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    }

    const hasRated = await hasUserRated(activityId, raterUid);

    return res.status(200).json({
      ok: true,
      data: { hasRated },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}
