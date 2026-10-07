/** Return ISO date string (YYYY-MM-DD) for a Date or timestamp. */
export function toIsoDate(input: Date | number | string): string {
  const date = input instanceof Date ? input : new Date(input);
  return date.toISOString().slice(0, 10);
}

/** Return a relative-time string (e.g. "5 minutes ago"). Purely indicative. */
export function timeAgo(input: Date | number | string): string {
  const date = input instanceof Date ? input : new Date(input);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}