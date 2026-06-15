import { writable } from 'svelte/store';

export const user = writable(null);

// Load user data from local storage on initialization
export function loadUserFromStorage() {
  const userData = localStorage.getItem('user');
  if (userData) {
    user.set(JSON.parse(userData));
  } else {
    user.set(null);
  }
}

// log out function to clear user data
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  user.set(null);
}