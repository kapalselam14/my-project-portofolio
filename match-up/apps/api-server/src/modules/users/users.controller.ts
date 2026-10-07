import type { Request, Response } from 'express';
import {
  bootstrapUser,
  getPublicUserProfile,
  getUserByAuthUid,
  mintCustomToken,
  updateUserPhoto,
  updateUserProfile,
  type SkillLevel,
  type UpdateUserProfileInput,
} from './users.service.js';
import { createNotification, renderTemplate } from '../notifications/notifications.service.js';
import {
  attachViewerActivityContext,
  listMyActivities,
  listPastActivitiesForUser,
} from '../activities/activities.service.js';

type PublicProfileParams = {
  uid: string;
};

// Keep the API's accepted profile fields explicit so clients cannot mass-assign stored account data.
const editableProfileFields = [
  'displayName',
  'bio',
  'gender',
  'dateOfBirth',
  'heightCm',
  'weightKg',
  'goal',
  'skillLevel',
  'preferredSports',
  'sportSkillLevels',
  'preferredLocations',
  'joinReason',
] as const;

function isSkillLevel(value: unknown): value is SkillLevel {
  return (
    value === 'beginner' || value === 'intermediate' || value === 'advanced' || value === 'any'
  );
}

function hasUnknownProfileFields(body: Record<string, unknown>): boolean {
  return Object.keys(body).some((key) => !editableProfileFields.includes(key as never));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSportSkillLevels(value: unknown): value is Record<string, SkillLevel> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.entries(value as Record<string, unknown>).every(
    ([sport, level]) => sport.trim().length > 0 && isSkillLevel(level),
  );
}

function buildProfileInput(body: Record<string, unknown>): UpdateUserProfileInput {
  // Copy only validated, supported values and normalize user-entered strings before persistence.
  const input: UpdateUserProfileInput = {};

  for (const field of ['displayName', 'bio', 'gender', 'dateOfBirth'] as const) {
    if (body[field] !== undefined) {
      input[field] = (body[field] as string).trim();
    }
  }

  if (isSkillLevel(body.skillLevel)) {
    input.skillLevel = body.skillLevel;
  }

  if (typeof body.heightCm === 'number') {
    input.heightCm = body.heightCm;
  }

  if (typeof body.weightKg === 'number') {
    input.weightKg = body.weightKg;
  }

  if (typeof body.goal === 'string' && body.goal.trim()) {
    input.goal = body.goal.trim();
  }

  if (isStringArray(body.preferredSports)) {
    input.preferredSports = body.preferredSports.map((sport) => sport.trim()).filter(Boolean);
  }

  if (isSportSkillLevels(body.sportSkillLevels)) {
    input.sportSkillLevels = body.sportSkillLevels;
  }

  if (typeof body.joinReason === 'string' && body.joinReason.trim()) {
    input.joinReason = body.joinReason.trim();
  }

  if (isStringArray(body.preferredLocations)) {
    input.preferredLocations = body.preferredLocations
      .map((location) => location.trim())
      .filter(Boolean);
  }

  return input;
}

export async function bootstrapUserHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;
    const tokenEmail = req.auth?.token.email;
    const { email } = req.body as {
      email?: unknown;
    };

    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    const emailToUse = typeof tokenEmail === 'string' ? tokenEmail : email;

    if (typeof emailToUse !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'email must be a string',
        },
      });
    }

    if (!emailToUse.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'email is required',
        },
      });
    }

    const user = await bootstrapUser({
      authUid,
      email: emailToUse,
    });

    if (user.created) {
      // Welcome nudge for genuinely new accounts (best-effort).
      const template = await renderTemplate('account.welcome', {
        userName: emailToUse.split('@')[0] ?? 'there',
      });
      if (template) {
        await createNotification({
          recipientUid: user.authUid,
          type: 'system',
          title: template.title,
          body: template.body,
        }).catch(() => undefined);
      }
    }

    return res.status(user.created ? 201 : 200).json({
      ok: true,
      data: user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Email already in use') {
      return res.status(409).json({
        ok: false,
        error: {
          code: 'CONFLICT',
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

export async function getCustomTokenHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;

    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    const customToken = await mintCustomToken(authUid);

    return res.status(200).json({
      ok: true,
      data: { customToken },
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

export async function getMyUserHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;

    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    const user = await getUserByAuthUid(authUid);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: user,
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

export async function updateMyUserProfileHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;
    const body = req.body as Record<string, unknown>;

    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    // Key-only debug logging (no values — privacy safe) for client/server contract mismatches.
    if (process.env.DEBUG_USER_PATCH === '1') {
      try {
        console.debug(`[users] PATCH /me keys=${Object.keys(body ?? {}).join(',')}`);
      } catch {
        // Logging must never break the request.
      }
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'request body must be an object',
        },
      });
    }

    for (const key of Object.keys(body)) {
      if (body[key] === null) delete body[key];
    }

    if (hasUnknownProfileFields(body)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'request body contains unsupported profile fields',
        },
      });
    }

    if (Object.keys(body).length === 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'at least one profile field is required',
        },
      });
    }

    for (const field of ['displayName', 'bio', 'gender', 'dateOfBirth'] as const) {
      if (body[field] !== undefined && typeof body[field] !== 'string') {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: `${field} must be a string`,
          },
        });
      }
    }

    if (body.skillLevel !== undefined && !isSkillLevel(body.skillLevel)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'skillLevel must be beginner, intermediate, advanced, or any',
        },
      });
    }

    if (
      body.heightCm !== undefined &&
      (typeof body.heightCm !== 'number' ||
        !Number.isInteger(body.heightCm) ||
        body.heightCm < 50 ||
        body.heightCm > 300)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'heightCm must be an integer between 50 and 300',
        },
      });
    }

    if (
      body.weightKg !== undefined &&
      (typeof body.weightKg !== 'number' ||
        !Number.isInteger(body.weightKg) ||
        body.weightKg < 30 ||
        body.weightKg > 300)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'weightKg must be an integer between 30 and 300',
        },
      });
    }

    if (body.goal !== undefined && typeof body.goal !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'goal must be a string',
        },
      });
    }

    if (body.preferredSports !== undefined && !isStringArray(body.preferredSports)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'preferredSports must be a string array',
        },
      });
    }

    if (body.sportSkillLevels !== undefined && !isSportSkillLevels(body.sportSkillLevels)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message:
            'sportSkillLevels must map sport names to beginner, intermediate, advanced, or any',
        },
      });
    }

    if (body.joinReason !== undefined && typeof body.joinReason !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'joinReason must be a string',
        },
      });
    }

    if (body.preferredLocations !== undefined && !isStringArray(body.preferredLocations)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'preferredLocations must be a string array',
        },
      });
    }

    const user = await updateUserProfile(authUid, buildProfileInput(body));

    return res.status(200).json({
      ok: true,
      data: user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'User not found') {
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

export async function updateMyUserPhotoHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;
    const { photoPath, photoUrl } = req.body as {
      photoPath?: unknown;
      photoUrl?: unknown;
    };

    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (typeof photoPath !== 'string' || typeof photoUrl !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'photoPath and photoUrl must be strings',
        },
      });
    }

    if (!photoPath.trim() || !photoUrl.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'photoPath and photoUrl are required',
        },
      });
    }

    if (!photoPath.trim().startsWith(`users/${authUid}/profile/`)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'photoPath must belong to the authenticated user',
        },
      });
    }

    const user = await updateUserPhoto(authUid, {
      photoPath,
      photoUrl,
    });

    return res.status(200).json({
      ok: true,
      data: user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'User not found') {
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

const USER_ACTIVITIES_LIMIT_DEFAULT = 20;
const USER_ACTIVITIES_LIMIT_MAX = 50;

function parseUserActivitiesPaging(
  req: Request,
): { limit: number; offset: number } | { error: { code: string; message: string } } {
  const { limit, offset } = req.query as { limit?: unknown; offset?: unknown };
  const parsedLimit = limit === undefined ? USER_ACTIVITIES_LIMIT_DEFAULT : Number(limit);
  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit <= 0 ||
    parsedLimit > USER_ACTIVITIES_LIMIT_MAX
  ) {
    return {
      error: { code: 'INVALID_INPUT', message: 'limit must be an integer between 1 and 50' },
    };
  }
  const parsedOffset = offset === undefined ? 0 : Number(offset);
  if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
    return { error: { code: 'INVALID_INPUT', message: 'offset must be a non-negative integer' } };
  }
  return { limit: parsedLimit, offset: parsedOffset };
}

/** Serve legacy profile activity URLs from the shared activity queries and viewer-context mapper. */
async function userActivitiesHandler(
  req: Request<PublicProfileParams>,
  res: Response,
  kind: 'joined' | 'hosted' | 'past',
) {
  try {
    const { uid } = req.params;
    if (!uid?.trim()) {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: 'uid is required' },
      });
    }
    const viewerUid = req.auth?.uid;
    if (!viewerUid) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authenticated user is required' },
      });
    }
    const paging = parseUserActivitiesPaging(req);
    if ('error' in paging) {
      return res.status(400).json({ ok: false, error: paging.error });
    }
    const rows =
      kind === 'past'
        ? await listPastActivitiesForUser(uid, paging.limit, paging.offset)
        : await listMyActivities(uid, kind, paging.limit, paging.offset);
    const data = await Promise.all(
      rows.map((activity) => attachViewerActivityContext(activity, viewerUid)),
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

export async function getUserJoinedActivitiesHandler(
  req: Request<PublicProfileParams>,
  res: Response,
) {
  return userActivitiesHandler(req, res, 'joined');
}

export async function getUserHostedActivitiesHandler(
  req: Request<PublicProfileParams>,
  res: Response,
) {
  return userActivitiesHandler(req, res, 'hosted');
}

export async function getUserPastActivitiesHandler(
  req: Request<PublicProfileParams>,
  res: Response,
) {
  return userActivitiesHandler(req, res, 'past');
}

export async function getPublicUserProfileHandler(
  req: Request<PublicProfileParams>,
  res: Response,
) {
  try {
    const { uid } = req.params;

    if (!uid.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'uid is required',
        },
      });
    }

    const profile = await getPublicUserProfile(uid);

    if (!profile) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: profile,
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
