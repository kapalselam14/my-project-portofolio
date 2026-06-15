import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function getErrorMessage(error, fallback) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.message ||
    fallback
  );
}

export function normalizeInventoryItems(response) {
  const payload = response?.data || response;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.inventoryItems)) return payload.inventoryItems;

  return [];
}

export async function getInventory(token) {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/inventory`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'failed to fetch inventory'));
  }
}

export function normalizePetCollection(response) {
  const payload = response?.data || response;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.pets)) return payload.pets;
  if (Array.isArray(payload?.inactivePets)) return payload.inactivePets;

  return [];
}

export async function getPetCollection(token) {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/pets/collection`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'failed to fetch pet collection'));
  }
}
