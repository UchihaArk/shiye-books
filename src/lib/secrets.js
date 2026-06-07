/**
 * 文章暗号验证与解锁状态管理。
 *
 * - secrets-hash.js 由构建脚本自动生成，包含每篇文章暗号的 SHA-256 哈希。
 * - 验证使用浏览器原生 Web Crypto API。
 * - 解锁状态持久化到 localStorage，避免重复验证。
 */

import secretHashes from './secrets-hash';

const UNLOCK_KEY = 'sy-unlocked';

/**
 * 计算字符串的 SHA-256 哈希（十六进制）。
 */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 验证输入的暗号是否匹配指定文章。
 * @param {string} essayId - 文章 slug
 * @param {string} input - 用户输入的暗号
 * @returns {Promise<boolean>}
 */
export async function verifySecret(essayId, input) {
  const expected = secretHashes[essayId];
  if (!expected) return false;
  const hash = await sha256(input);
  return hash === expected;
}

/**
 * 从 localStorage 读取已解锁的文章 ID 集合。
 * @returns {Set<string>}
 */
export function getUnlockedIds() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return new Set();
    const obj = JSON.parse(raw);
    return new Set(Object.keys(obj));
  } catch {
    return new Set();
  }
}

/**
 * 标记文章为已解锁。
 */
export function markUnlocked(essayId) {
  const ids = getUnlockedIds();
  ids.add(essayId);
  const obj = {};
  for (const id of ids) {
    obj[id] = Date.now();
  }
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(obj));
  } catch {}
}

/**
 * 检查文章是否已解锁。
 */
export function isUnlocked(essayId) {
  return getUnlockedIds().has(essayId);
}
