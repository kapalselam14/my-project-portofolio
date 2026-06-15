import { writable } from 'svelte/store';

// When set to true, home page should refresh articles
export const refreshHomeArticles = writable(false);