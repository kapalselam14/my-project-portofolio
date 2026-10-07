/** Convert a string to a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Truncate a string to `max` characters, appending an ellipsis if cut. */
export function truncate(input: string, max = 80): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1))}…`;
}