import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function wrapAxiosError(error, fallback = 'Request failed') {
  const message = error.response?.data?.message || error.message || fallback;
  const err = new Error(message);
  err.status = error.response?.status;
  return err;
}

export async function updateProfile(payload) {
  const token = localStorage.getItem('token');
  if (!token) {
    const err = new Error('Not authenticated. Please log in again.');
    err.status = 401;
    throw err;
  }

  try {
    const res = await axios.patch(`${API_BASE_URL}/api/users/me`, payload, {
      headers: { 'Content-Type': 'application/json', ...authHeader() }
    });
    return res.data;
  } catch (error) {
    throw wrapAxiosError(error, 'Failed to update profile');
  }
}

export async function updatePassword(payload) {
  const token = localStorage.getItem('token');
  if (!token) {
    const err = new Error('Not authenticated. Please log in again.');
    err.status = 401;
    throw err;
  }

  try {
    const res = await axios.patch(`${API_BASE_URL}/api/users/me/password`, payload, {
      headers: { 'Content-Type': 'application/json', ...authHeader() }
    });
    return res.data;
  } catch (error) {
    throw wrapAxiosError(error, 'Failed to update password');
  }
}

export async function identifyUserForReset(identifier) {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/forgot/identify`, { identifier });
    return res.data;
  } catch (error) {
    throw wrapAxiosError(error, 'Failed to identify user');
  }
}

export async function resetPasswordWithSecurityAnswer(payload) {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/forgot/reset`, payload);
    return res.data;
  } catch (error) {
    throw wrapAxiosError(error, 'Failed to reset password');
  }
}

export async function getTaskStats() {
  const token = localStorage.getItem('token');
  if (!token) {
    const err = new Error('Not authenticated. Please log in again.');
    err.status = 401;
    throw err;
  }

  try {
    const res = await axios.get(`${API_BASE_URL}/api/users/me/task-stats`, {
      headers: { ...authHeader() }
    });
    return res.data;
  } catch (error) {
    throw wrapAxiosError(error, 'Failed to load task stats');
  }
}