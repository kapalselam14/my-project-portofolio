import { writable } from 'svelte/store';

// Sort state: field and order
export const sortBy = writable('date');
export const sortOrder = writable('desc');

