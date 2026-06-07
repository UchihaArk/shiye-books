/**
 * On-demand essay content loader with in-memory cache.
 *
 * Meta data is loaded via api.js loadIndex().
 * Full content (article body + chapters) is fetched per-essay via JSON from remote API.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';
const cache = new Map();

/**
 * Load full content for an essay. Returns:
 * { content: string, chapters: [{ slug, title, content }] }
 *
 * Cached after first load — subsequent calls for the same slug are instant.
 */
export async function loadEssayContent(slug) {
  if (cache.has(slug)) return cache.get(slug);

  const res = await fetch(`${API_BASE}/api/essay/${encodeURIComponent(slug)}.json`);
  if (!res.ok) throw new Error(`Failed to load essay: ${slug}`);

  const data = await res.json();
  cache.set(slug, data);
  return data;
}

/**
 * Preload content for an essay (e.g. on card hover).
 * Silent — errors are swallowed.
 */
export function preloadEssayContent(slug) {
  if (cache.has(slug)) return;
  loadEssayContent(slug).catch(() => {});
}

/**
 * Clear the cache (useful if essays are hot-updated in dev).
 */
export function clearContentCache() {
  cache.clear();
}
