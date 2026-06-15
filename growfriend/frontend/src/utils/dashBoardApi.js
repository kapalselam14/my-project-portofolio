import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function getErrorMessage(error, fallback) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.message ||
    fallback
  );
}

export async function getDashboard(token) {
  try {
    const res = await axios.get(`${API_BASE}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'failed to fetch dashboard'));
  }
}