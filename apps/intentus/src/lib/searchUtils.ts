/**
 * Escape special ILIKE characters to prevent pattern injection attacks.
 * Characters %, _ and \ are escaped with a backslash prefix.
 */
export function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}
