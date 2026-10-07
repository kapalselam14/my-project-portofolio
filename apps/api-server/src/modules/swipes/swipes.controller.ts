import type { Request, Response } from 'express';
import { getSwipeDecision, listSwipeDecisions, saveSwipeDecision } from './swipes.service.js';

// Swipe deck API: records pass/join intent. Join runs separately so the host gets one notification per join.

type GetMySwipeParams = {
  activityId: string;
};

export async function saveSwipeDecisionHandler(req: Request, res: Response) {
  try {
    const uid = req.auth?.uid;
    const { activityId, decision } = req.body as {
      activityId?: unknown;
      decision?: unknown;
    };

    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (typeof activityId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'activityId must be a string',
        },
      });
    }

    if (decision !== 'pass' && decision !== 'join') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'decision must be pass or join',
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

    await saveSwipeDecision({
      uid,
      activityId,
      decision,
    });

    // No notification here by design: a right-swipe is always followed by join/request, which notify the host.

    return res.status(200).json({
      ok: true,
      data: {
        uid,
        activityId,
        decision,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
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

export async function getMySwipeDecisionHandler(req: Request<GetMySwipeParams>, res: Response) {
  try {
    const uid = req.auth?.uid;
    const { activityId } = req.params;

    if (!uid) {
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

    const swipe = await getSwipeDecision(uid, activityId);

    // Missing decision means unseen — the deck treats 404 as "still swipable".
    if (!swipe) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Swipe decision not found',
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: swipe,
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

export async function listMySwipeDecisionsHandler(req: Request, res: Response) {
  try {
    const uid = req.auth?.uid;

    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    const swipes = await listSwipeDecisions(uid);

    // Lets the deck filter out decided cards locally without refetching the feed.

    return res.status(200).json({
      ok: true,
      data: swipes,
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
