// derive current user from localStorage when available so components
// that rely on CURRENT_USER_ID work with the real backend token/user
// during development. Falls back to legacy mock values otherwise.
let _currentUserId = 'user-001';
let _currentUserName = 'Alex';

if (typeof window !== 'undefined') {
	try {
		const raw = localStorage.getItem('gf_current_user');
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed?.id) _currentUserId = String(parsed.id);
			if (parsed?.username) _currentUserName = parsed.username || _currentUserName;
		}
	} catch (e) {
		// ignore parse errors and keep defaults
	}
}

export const CURRENT_USER_ID = _currentUserId;
export const CURRENT_USER_NAME = _currentUserName;
