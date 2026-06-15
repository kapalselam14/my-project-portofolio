// Simple in-memory Server-Sent Events (SSE) notification bus
// - registerConnection(userId, res): attach an SSE response for a user
// - unregisterConnection(userId, res): detach a specific SSE response
// - publishToUser(userId, event): send a JSON event to all that user's SSE clients

const connections = new Map(); // userId -> Set<res>

function ensureSet(userId) {
	if (!connections.has(userId)) {
		connections.set(userId, new Set());
	}
	return connections.get(userId);
}

export function registerConnection(userId, res) {
	const set = ensureSet(userId);
	set.add(res);

	// Clean up on close
	reqSafeOnClose(res, () => unregisterConnection(userId, res));
}

export function unregisterConnection(userId, res) {
	const set = connections.get(userId);
	if (set) {
		set.delete(res);
		if (set.size === 0) connections.delete(userId);
	}
}

export function publishToUser(userId, event) {
	const set = connections.get(userId);
	if (!set || set.size === 0) return;
	const payload = `data: ${JSON.stringify(event)}\n\n`;
	for (const res of set) {
		try {
			res.write(payload);
		} catch {
			// If write fails, drop this connection
			unregisterConnection(userId, res);
		}
	}
}

// Helper to attach a close listener safely
function reqSafeOnClose(res, cb) {
	// Some environments emit 'close', some 'finish', we subscribe to both
	let called = false;
	const once = () => {
		if (called) return;
		called = true;
		try { cb(); } catch {}
	};
	res.on('close', once);
	res.on('finish', once);
}

