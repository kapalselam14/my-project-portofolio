// Find an active like notification for a given actor, recipient, and article
export async function findActiveLikeNotification({ actor_id, recipient_id, article_id }) {
	const db = await getDatabase();
	const row = await db.get(
		`SELECT * FROM Notification WHERE actor_id = ? AND recipient_id = ? AND article_id = ? AND is_active = 1`,
		actor_id,
		recipient_id,
		article_id
	);
	return row;
}
import { getDatabase } from "./database.js";

// Create a new notification
// payload: { recipient_id, actor_id, article_id }
export async function createNotification(payload) {
	const { recipient_id, actor_id, article_id, type, message, link } = payload;
	const db = await getDatabase();
	const result = await db.run(
		"INSERT INTO Notification(recipient_id, actor_id, article_id, type, is_active, message, link) VALUES(?, ?, ?, ?, 1, ?, ?)",
		recipient_id,
		actor_id,
		article_id,
		type,
		message,
		link
	);
	const row = await db.get("SELECT * FROM Notification WHERE id = ?", result.lastID);
	return row;
}

// List notifications for a user
export async function listNotificationsForUser(recipientId, opts = {}) {
	const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.min(100, opts.limit)) : 20;
	const offset = Number.isFinite(opts.offset) ? Math.max(0, opts.offset) : 0;
	const unreadOnly = !!opts.unreadOnly;

	const db = await getDatabase();
	const params = [recipientId];
	let sql = `
		SELECT n.*, u.username as actor_username, u.avatar_url as actor_avatar_url,
					 a.title as article_title
		FROM Notification n
		JOIN User u ON n.actor_id = u.id
		JOIN Article a ON n.article_id = a.id
		WHERE n.is_active = 1 AND n.recipient_id = ?`;
	if (unreadOnly) {
		sql += " AND n.is_read = 0";
	}
	sql += " ORDER BY n.created_at DESC LIMIT ? OFFSET ?";
	params.push(limit, offset);
	const rows = await db.all(sql, ...params);
	return rows;
}

// Mark specific notifications read for a user
export async function markNotificationsRead(ids, recipientId) {
	if (!Array.isArray(ids) || ids.length === 0) return { updated: 0 };
	const placeholders = ids.map(() => "?").join(", ");
	const db = await getDatabase();
	const result = await db.run(
		`UPDATE Notification SET is_read = 1 WHERE recipient_id = ? AND id IN (${placeholders})`,
		recipientId,
		...ids
	);
	return { updated: result.changes ?? 0 };
}

// Mark all notifications read for a user
export async function markAllNotificationsRead(recipientId) {
	const db = await getDatabase();
	const result = await db.run(
		"UPDATE Notification SET is_read = 1 WHERE recipient_id = ? AND is_read = 0",
		recipientId
	);
	return { updated: result.changes ?? 0 };
}

// Count unread notifications
export async function countUnreadNotifications(recipientId) {
	const db = await getDatabase();
	const row = await db.get(
		"SELECT COUNT(*) AS cnt FROM Notification WHERE recipient_id = ? AND is_active = 1 AND is_read = 0",
		recipientId
	);
	return row?.cnt ?? 0;
}

