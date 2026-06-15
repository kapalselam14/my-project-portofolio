import axios from 'axios';

// Token key must match what the auth integration stores after login
const TOKEN_KEY = 'token';
const CURRENT_USER_KEY = 'gf_current_user';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001'}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Only redirect when a token existed but was rejected (expired / invalid).
    // If there is no token the 401 is simply propagated to the caller.
    if (error.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
