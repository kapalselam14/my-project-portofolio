import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Start a new focus session
export async function startFocusSession(plannedDurationSec) {
  const res = await axios.post(
    `${API_BASE_URL}/api/focus/start`,
    plannedDurationSec ? { plannedDurationSec } : {},
    { headers: getAuthHeaders() }
  );
  return res.data;
}

// Complete a focus session (normal or cancelled)
export async function completeFocusSession(sessionId, { cancelled = false } = {}) {
  const endpoint = cancelled ? 'cancel' : 'complete';
  const res = await axios.post(
    `${API_BASE_URL}/api/focus/${sessionId}/${endpoint}`,
    {},
    { headers: getAuthHeaders() }
  );
  return res.data;
}

// Get active focus session
export async function getActiveFocusSession() {
  const res = await axios.get(
    `${API_BASE_URL}/api/focus/active`,
    { headers: getAuthHeaders() }
  );
  return res.data;
}