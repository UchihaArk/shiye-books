/**
 * 基于 KV 的固定窗口限流。
 * `scope` 为桶键（如 `ip:1.2.3.4`）。当前 `windowSec` 窗口内累计 `count`，
 * 超过 `limit` 则返回 false（拒绝）。桶用 expirationTtl 自动清理。
 */
export async function rateLimit(
  kv: KVNamespace,
  scope: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const key = `rl:${scope}`;
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  let windowStart = now;

  const raw = await kv.get(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { c: number; t: number };
      if (now - parsed.t < windowSec) {
        count = parsed.c;
        windowStart = parsed.t;
      }
    } catch {
      // 损坏条目 → 重新开始
    }
  }

  count += 1;
  await kv.put(key, JSON.stringify({ c: count, t: windowStart }), {
    expirationTtl: windowSec,
  });
  return count <= limit;
}
