
import express from "express";
import { requireAuth } from "../../middleware/auth-middleware.js";
import {
  listNotificationsForUser,
  markNotificationsRead,
  markAllNotificationsRead,
  countUnreadNotifications
} from "../../data/notifications-dao.js";
import { registerConnection, unregisterConnection } from "../../utils/notification-bus.js";
import enrichNotification from "../../utils/enrich-notification.js";

const router = express.Router();

// ...existing code...

// List notifications for current user
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit ?? 20, 10);
    const offset = parseInt(req.query.offset ?? 0, 10);
    const unreadOnly = req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
    const [notificationsRaw, unreadCount] = await Promise.all([
      listNotificationsForUser(userId, { limit, offset, unreadOnly }),
      countUnreadNotifications(userId)
    ]);
    const notifications = notificationsRaw.map(enrichNotification);
    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("GET /api/notifications error", err);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
});

// Mark a set of notifications as read
router.post("/mark-read", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const result = await markNotificationsRead(ids, userId);
    const unreadCount = await countUnreadNotifications(userId);
    return res.json({ ...result, unreadCount });
  } catch (err) {
    console.error("POST /api/notifications/mark-read error", err);
    return res.status(500).json({ error: "Failed to mark notifications read" });
  }
});

// Mark all notifications as read
router.post("/mark-all-read", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await markAllNotificationsRead(userId);
    return res.json({ ...result, unreadCount: 0 });
  } catch (err) {
    console.error("POST /api/notifications/mark-all-read error", err);
    return res.status(500).json({ error: "Failed to mark all notifications read" });
  }
});

// SSE stream for notifications
// SSE stream for notifications
import { getUsernameFromJWT } from "../../utils/jwt-utils.js";
import { getUserByUsername } from "../../data/user-dao.js";
import { isTokenBlacklisted } from "../../data/token-blacklist.js";

router.get("/stream", async (req, res) => {
  // Accept token via query param for SSE
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  console.log("SSE connection attempt with token:", token);
  if (!token) {
    return res
      .status(401)
      .json({ error: "Authentication required", message: "No token provided. Please login" });
  }
  if (isTokenBlacklisted(token)) {
    return res
      .status(401)
      .json({
        error: "Token revoked",
        message: "This token has been logged out. Please login again"
      });
  }
  let user;
  try {
    const username = getUsernameFromJWT(token);
    console.log("SSE token username:", username);
    user = await getUserByUsername(username);
    console.log("SSE token user:", user);
  } catch {
    return res
      .status(401)
      .json({ error: "Invalid token", message: "Your session is invalid. Please login again" });
    console.log("SSE token user fetch failed");
  }
  if (!user) {
    return res.status(401).json({ error: "Invalid user", message: "User not found" });
    console.log("SSE user not found");
  }
  const userId = user.id;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.flushHeaders?.();

  // Initial event: unread count
  try {
    const unreadCount = await countUnreadNotifications(userId);
    res.write(`data: ${JSON.stringify({ type: "init", unreadCount })}\n\n`);
  } catch {}

  // Register the connection in the bus
  registerConnection(userId, res);

  // Keepalive pings every 25s
  const keepAlive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {}
  }, 25000);

  const cleanup = () => {
    clearInterval(keepAlive);
    unregisterConnection(userId, res);
    try {
      res.end();
    } catch {}
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
});

export default router;
