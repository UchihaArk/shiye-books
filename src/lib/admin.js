/**
 * 超管删除令牌（仅本机 sessionStorage，关标签页即清）。
 * 通过 URL ?admin=TOKEN 注入：访问任意页面带该参数即进入管理模式，URL 随即清理。
 */

const KEY = 'sy-admin';

export function getAdminToken() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function isAdmin() {
  return !!getAdminToken();
}

export function clearAdminToken() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

/** 从 URL ?admin=TOKEN 注入令牌并清理地址栏（避免留在历史记录里）。 */
export function ingestAdminFromURL() {
  try {
    const u = new URL(window.location.href);
    const t = u.searchParams.get('admin');
    if (t) {
      try {
        sessionStorage.setItem(KEY, t);
      } catch {}
      u.searchParams.delete('admin');
      window.history.replaceState(null, '', u.toString());
    }
  } catch {}
}
