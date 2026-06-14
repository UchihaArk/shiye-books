/**
 * 极简匿名身份：crypto.getRandomValues 生成随机设备 pid 存 localStorage。
 * 仅作阅读进度的 KV 归属键（软身份，服务端不校验）。
 */

const PID_KEY = 'sy-pid';

/** 获取（必要时生成）本机匿名 pid（16 hex 字符）。 */
export function getPid() {
  let pid;
  try {
    pid = localStorage.getItem(PID_KEY);
  } catch {
    return '';
  }
  if (!pid || !/^[0-9a-f]{8,32}$/.test(pid)) {
    const bytes = new Uint8Array(8); // 64-bit
    crypto.getRandomValues(bytes);
    pid = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    try {
      localStorage.setItem(PID_KEY, pid);
    } catch {}
  }
  return pid;
}

/** 包装 fetch，自动注入 X-Sy-Id 头（阅读进度归属）。 */
export function pidFetch(url, opts = {}) {
  const pid = getPid();
  if (!pid) return fetch(url, opts); // localStorage 不可用时降级
  const headers = new Headers(opts.headers);
  headers.set('X-Sy-Id', pid);
  return fetch(url, { ...opts, headers });
}
