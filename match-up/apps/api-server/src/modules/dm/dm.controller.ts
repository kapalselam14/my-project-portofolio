import type { Request, Response } from 'express';
import {
  listDmConversations,
  listDmMessages,
  markDmThreadRead,
  resolveThread,
  sendDmMessage,
} from './dm.service.js';

type DmPeerParams = {
  uid: string;
};

function peerUid(req: Request<DmPeerParams>): string | null {
  const uid = req.params.uid;
  return typeof uid === 'string' && uid.trim() ? uid : null;
}

function errorBody(code: string, message: string) {
  return { ok: false, error: { code, message } };
}

/** `GET /api/dm/:uid/thread` — canonical conversation id for the pair. */
export async function getThreadHandler(req: Request<DmPeerParams>, res: Response) {
  try {
    const viewerUid = req.auth?.uid;
    const peer = peerUid(req);
    if (!viewerUid) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Authenticated user is required'));
    }
    if (peer === null) {
      return res.status(400).json(errorBody('INVALID_INPUT', 'peer uid is required'));
    }
    const result = await resolveThread(viewerUid, peer);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'User not found') {
      return res.status(404).json(errorBody('NOT_FOUND', message));
    }
    if (message === 'cannot message yourself' || message.endsWith('is required')) {
      return res.status(400).json(errorBody('INVALID_INPUT', message));
    }
    return res.status(500).json(errorBody('INTERNAL_ERROR', message));
  }
}

/** `GET /api/dm/:uid/messages?limit=` — recent thread history. */
export async function listDmMessagesHandler(req: Request<DmPeerParams>, res: Response) {
  try {
    const viewerUid = req.auth?.uid;
    const peer = peerUid(req);
    if (!viewerUid) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Authenticated user is required'));
    }
    if (peer === null) {
      return res.status(400).json(errorBody('INVALID_INPUT', 'peer uid is required'));
    }
    const { limit } = req.query as { limit?: unknown };
    const parsedLimit = typeof limit === 'string' && limit.trim() !== '' ? Number(limit) : 50;
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json(errorBody('INVALID_INPUT', 'limit must be a positive integer'));
    }
    const messages = await listDmMessages(viewerUid, peer, parsedLimit);
    return res.status(200).json({ ok: true, data: messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'User not found') {
      return res.status(404).json(errorBody('NOT_FOUND', message));
    }
    if (message === 'cannot message yourself' || message.endsWith('is required')) {
      return res.status(400).json(errorBody('INVALID_INPUT', message));
    }
    return res.status(500).json(errorBody('INTERNAL_ERROR', message));
  }
}

/** `POST /api/dm/:uid/messages {text}` — send + notify the peer. */
export async function sendDmHandler(req: Request<DmPeerParams>, res: Response) {
  try {
    const viewerUid = req.auth?.uid;
    const peer = peerUid(req);
    const { text } = req.body as { text?: unknown };
    if (!viewerUid) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Authenticated user is required'));
    }
    if (peer === null) {
      return res.status(400).json(errorBody('INVALID_INPUT', 'peer uid is required'));
    }
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json(errorBody('EMPTY_INPUT', 'text is required'));
    }
    const result = await sendDmMessage(viewerUid, peer, text);
    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'User not found') {
      return res.status(404).json(errorBody('NOT_FOUND', message));
    }
    if (
      message === 'cannot message yourself' ||
      message === 'text is required' ||
      message.startsWith('text must be')
    ) {
      const code = message === 'text is required' ? 'EMPTY_INPUT' : 'INVALID_INPUT';
      const status = code === 'EMPTY_INPUT' ? 400 : 400;
      return res.status(status).json(errorBody(code, message));
    }
    return res.status(500).json(errorBody('INTERNAL_ERROR', message));
  }
}

/** `GET /api/dm/conversations` — viewer's DM inbox, newest first. */
export async function listConversationsHandler(req: Request, res: Response) {
  try {
    const viewerUid = req.auth?.uid;
    if (!viewerUid) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Authenticated user is required'));
    }
    const rows = await listDmConversations(viewerUid);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json(errorBody('INTERNAL_ERROR', message));
  }
}

/** `POST /api/dm/:uid/read` — clear the unread badge for one thread. */
export async function markThreadReadHandler(req: Request<DmPeerParams>, res: Response) {
  try {
    const viewerUid = req.auth?.uid;
    const peer = peerUid(req);
    if (!viewerUid) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Authenticated user is required'));
    }
    if (peer === null) {
      return res.status(400).json(errorBody('INVALID_INPUT', 'peer uid is required'));
    }
    await markDmThreadRead(viewerUid, peer);
    return res.status(200).json({ ok: true, data: { peerUid: peer } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json(errorBody('INTERNAL_ERROR', message));
  }
}
