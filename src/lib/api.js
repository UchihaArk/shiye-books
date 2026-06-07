/**
 * Async essay index loader with caching.
 * Replaces the build-time virtual:essays module with runtime fetch.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';
const CACHE_KEY = 'sy-index-cache';
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

let indexPromise = null;

/**
 * Load essay metadata index from remote API.
 * Memory cache → localStorage cache → network fetch.
 * Returns { essays, essayOrder, allTags, categories }
 */
export async function loadIndex() {
  if (indexPromise) return indexPromise;

  // Try localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) {
        indexPromise = Promise.resolve(data);
        return indexPromise;
      }
    }
  } catch {}

  indexPromise = fetch(`${API_BASE}/api/index.json`, {
    cache: 'no-cache', // bypass browser disk cache, always validate with server
  })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load index: ${r.status}`);
      return r.json();
    })
    .then((data) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      } catch {}
      return data;
    })
    .catch((err) => {
      indexPromise = null;
      throw err;
    });

  return indexPromise;
}

/**
 * Clear all caches (for retry after error).
 */
export function clearIndexCache() {
  indexPromise = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}
