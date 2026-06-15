import { redirect } from '@sveltejs/kit';

export function load() {
  // Check for auth token in localStorage (client-side only)
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('token');
    if (!token) {
      throw redirect(302, '/login');
    }
  }
}
