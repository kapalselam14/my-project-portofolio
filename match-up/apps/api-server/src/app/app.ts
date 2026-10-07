import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { checkFirestoreConnection } from '../database/firebase.js';
import { firestoreAuthHint, isFirestoreAuthError } from '../database/firestore-errors.js';
import { corsOrigins, env } from '../config/env.js';
import {
  AUTOCOMPLETE_RATE_LIMIT,
  GLOBAL_RATE_LIMIT,
  TYPING_RATE_LIMIT,
  createRateLimiter,
} from '../middleware/rate-limit.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { presenceRouter } from '../modules/presence/presence.routes.js';
import { typingRouter } from '../modules/typing/typing.routes.js';
import { chatRouter } from '../modules/chat/chat.routes.js';
import { dmRouter } from '../modules/dm/dm.routes.js';
import { activitiesRouter } from '../modules/activities/activities.routes.js';
import { adminRouter } from '../modules/admin/admin.routes.js';
import { appealsRouter } from '../modules/appeals/appeals.routes.js';
import { listPublicActivityTeasersHandler } from '../modules/activities/activities.controller.js';
import { listPublicSportsHandler } from '../modules/admin/public-sports.controller.js';
import { swipesRouter } from '../modules/swipes/swipes.routes.js';
import { calendarRouter } from '../modules/calendar/calendar.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { devicesRouter } from '../modules/devices/devices.routes.js';
import { placesRouter } from '../modules/places/places.routes.js';
import { reportsRouter } from '../modules/reports/reports.routes.js';

export function createApp() {
  const app = express();

  // Trust the first proxy hop so `req.ip` is the real client IP behind Cloud Run.
  app.set('trust proxy', 1);

  const allowedOrigins = corsOrigins();
  if (allowedOrigins.length === 0) {
    // Fail closed in production; allow all origins only for local dev.
    if (env.NODE_ENV === 'production') {
      throw new Error(
        '[cors] CORS_ORIGINS is not set — refusing to boot in production. ' +
          'Set CORS_ORIGINS to a comma-separated allowlist.',
      );
    }
    // Local/dev default. Set CORS_ORIGINS in production (enforced above).
    console.warn(
      '[cors] CORS_ORIGINS is not set — allowing all origins. ' +
        'Set CORS_ORIGINS to a comma-separated allowlist in production.',
    );
    app.use(cors());
  } else {
    app.use(cors({ origin: allowedOrigins }));
  }
  app.use(helmet());
  app.use(morgan(':date[iso] :method :url :status :response-time ms'));
  // Global volume guard (skips health). Tighter burst caps below for hot endpoints.
  app.use(createRateLimiter(GLOBAL_RATE_LIMIT));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/typing', createRateLimiter(TYPING_RATE_LIMIT));
  app.use('/api/places/autocomplete', createRateLimiter(AUTOCOMPLETE_RATE_LIMIT));

  app.get('/api/health', async (_req, res) => {
    try {
      await checkFirestoreConnection();
      res.json({
        ok: true,
        data: {
          status: 'ok',
          service: 'api-server',
          database: 'connected',
        },
      });
    } catch (error) {
      if (isFirestoreAuthError(error)) {
        console.error(`[health] ${firestoreAuthHint()}`);
      } else {
        console.error('[health] Firestore unreachable:', error);
      }
      res.status(503).json({
        ok: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: 'Firestore unreachable',
        },
      });
    }
  });

  app.get('/api/public/activities', listPublicActivityTeasersHandler);
  app.get('/api/public/sports', listPublicSportsHandler);

  app.use('/api/users', usersRouter);
  app.use('/api/presence', presenceRouter);
  app.use('/api/typing', typingRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/dm', dmRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/swipes', swipesRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/places', placesRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/appeals', appealsRouter);
  app.use('/api/admin', adminRouter);

  // Unknown /api/* routes use the JSON envelope (clients parse every response as such).
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    });
  });

  // Error handler: always the envelope, never leaks stacks. Registered last.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    // Stacks stay in the server log; clients only get the envelope.
    console.error('[api] unhandled error:', err);
    const bodyStatus = bodyParserErrorStatus(err);
    if (bodyStatus === 413) {
      res.status(413).json({
        ok: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request body too large',
        },
      });
      return;
    }
    if (bodyStatus === 400) {
      res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid JSON body',
        },
      });
      return;
    }
    res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  });

  return app;
}

/** Maps express.json() failures to their HTTP status, else null. */
function bodyParserErrorStatus(err: unknown): 400 | 413 | null {
  if (typeof err !== 'object' || err === null) {
    return null;
  }
  const record = err as { status?: unknown; type?: unknown };
  if (record.type === 'entity.too.large' && record.status === 413) {
    return 413;
  }
  if (
    (record.type === 'entity.parse.failed' || err instanceof SyntaxError) &&
    record.status === 400
  ) {
    return 400;
  }
  return null;
}
