import { writable } from 'svelte/store';
import { browser } from '$app/environment';


const storedToken = browser ? localStorage.getItem('token') : null;
const storedUser = browser ? localStorage.getItem('user') : null;
const initial = storedToken ? { user: storedUser ? JSON.parse(storedUser) : null, token: storedToken } : null;
const auth = writable(initial);

export async function restoreAuthFromStorage() {
  if (!browser) return;
  try {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user = userStr ? JSON.parse(userStr) : null;
    if (token && !user) {
      // Fetch user info from backend
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        user = await res.json();
        localStorage.setItem('user', JSON.stringify(user));
      }
    }
    if (token) {
      auth.set({ user, token });
    }
  } catch {}
}



// Keep store in sync with localStorage
if (browser) {
  auth.subscribe(val => {
    if (!val) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } else {
      localStorage.setItem('token', val.token);
      localStorage.setItem('user', JSON.stringify(val.user));
    }
  });
}

export { auth };

export function login(user, token) {
  auth.set({ user, token });
  if (browser) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
}

export function logout() {
  auth.set(null);
  if (browser) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}
