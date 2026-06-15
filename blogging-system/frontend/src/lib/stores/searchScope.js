import { writable } from 'svelte/store';

// Search scope: 'global' or { type: 'user', userId: number, username: string }
export const searchScope = writable('global');

// Track if user explicitly chose global scope (to prevent automatic resets)
export const userChoseGlobalScope = writable(false);

// Helper to check if scope is global
export function isGlobalScope(scope) {
  return scope === 'global';
}

// Helper to get scope display text
export function getScopeDisplayText(scope) {
  if (scope === 'global') {
    return 'All Articles';
  }
  return `${scope.username}'s Posts`;
}

// Helper to get scope icon
export function getScopeIcon(scope) {
  if (scope === 'global') {
    return '🌐';
  }
  return '👤';
}

