import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export async function register(payload) {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/register`, payload);
    // Backend wraps response: { success, message, data: { token, user } }
    // Save token and return user for App to handle
    if (res.data.data?.token) {
      localStorage.setItem('token', res.data.data.token);
    }
    return { success: res.data.success, user: res.data.data?.user, error: res.data.message };
  } catch (error) {
    throw new Error(error.response?.data?.message || 'failed to register');
  }
}

export async function login(email, password) {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
    // Backend wraps response: { success, message, data: { token, user } }
    // Save token and return user for App to handle
    if (res.data.data?.token) {
      localStorage.setItem('token', res.data.data.token);
    }
    return { success: res.data.success, user: res.data.data?.user, error: res.data.message };
  } catch (error) {
    throw new Error(error.response?.data?.message || 'failed to login');
  }
}

export async function getCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  } catch {
    return null;
  }
}

export function logout(setCurrentUser) {
  setCurrentUser(null);
  localStorage.removeItem('token');
  localStorage.removeItem('gf_current_user');
}
