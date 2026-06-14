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

/**
 * 记录一次阅读（每次进入文章 +1，不去重）。返回最新计数，失败静默返回 null。
 */
export async function postView(slug) {
  try {
    const r = await fetch(`${API_BASE}/api/stats/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return typeof data.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}

/**
 * 批量获取阅读量，返回 { [slug]: count }（未记录的 slug 不出现，调用方按 0 处理）。
 */
export async function getViews(slugs) {
  if (!slugs || !slugs.length) return {};
  try {
    const r = await fetch(`${API_BASE}/api/meta/views?slugs=${encodeURIComponent(slugs.join(','))}`);
    if (!r.ok) return {};
    return await r.json();
  } catch {
    return {};
  }
}

/** 紧凑展示数字：1234 → "1.2k"，12345 → "1.2万"。 */
export function formatCount(n) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

// ── 阅读进度（按匿名 pid 存 KV）──
import { pidFetch } from './identity';

/**
 * 读取某篇阅读进度。返回 { chapter, p, updated_at }，无记录返回 null。
 */
export async function getProgress(slug) {
  if (!slug) return null;
  try {
    const r = await pidFetch(`${API_BASE}/api/progress?slug=${encodeURIComponent(slug)}`);
    if (!r.ok) return null;
    const data = await r.json();
    return data && typeof data === 'object' && Object.keys(data).length ? data : null;
  } catch {
    return null;
  }
}

/**
 * 保存阅读进度。chapter=章节序号，p=该章节内滚动百分比 0..100。失败静默。
 */
export async function saveProgress(slug, chapter, p) {
  if (!slug) return;
  try {
    await pidFetch(`${API_BASE}/api/progress?slug=${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter, p }),
    });
  } catch {}
}

// ── 片段书评（"看看大家都说了什么"）──

/** 取某文章各段落的评论数 { [paragraph_id]: count }。 */
export async function getCommentCounts(essaySlug) {
  if (!essaySlug) return {};
  try {
    const r = await fetch(`${API_BASE}/api/comments/counts?essay=${encodeURIComponent(essaySlug)}`);
    if (!r.ok) return {};
    return await r.json();
  } catch {
    return {};
  }
}

/** 取某段落的评论列表 { items:[{id,content,created_at}], hasMore }。before 为游标 id。 */
export async function getComments(essaySlug, paragraphId, before = 0) {
  if (!essaySlug || !paragraphId) return { items: [], hasMore: false };
  try {
    let q = `essay=${encodeURIComponent(essaySlug)}&pid=${encodeURIComponent(paragraphId)}&limit=50`;
    if (before) q += `&before=${before}`;
    const r = await fetch(`${API_BASE}/api/comments?${q}`);
    if (!r.ok) return { items: [], hasMore: false };
    return await r.json();
  } catch {
    return { items: [], hasMore: false };
  }
}

/** 发表评论 { essay, pid, content } → { id, created_at } | null（失败/限流）。 */
export async function postComment(essaySlug, paragraphId, content) {
  try {
    const r = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ essay: essaySlug, pid: paragraphId, content }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── 超管删除评论（需 ?admin=TOKEN 进入管理模式）──
import { getAdminToken } from './admin';

/** 删除评论（超管）。成功返回 true。 */
export async function deleteComment(id) {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const r = await fetch(`${API_BASE}/api/comments/${id}`, {
      method: 'DELETE',
      headers: { 'X-Sy-Admin': token },
    });
    return r.ok;
  } catch {
    return false;
  }
}
