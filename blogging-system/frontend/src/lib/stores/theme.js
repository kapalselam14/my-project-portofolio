import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function initial() {
  if (!browser) return 'light';
  const saved = localStorage.getItem('theme');
  if (saved) return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = writable(initial());

if (browser) {
  theme.subscribe(t => localStorage.setItem('theme', t));
}