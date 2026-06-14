import { json, jsonError } from '../../_lib/response';
import { pidFromRequest } from '../../_lib/request';
import type { Env } from '../../_lib/types';

// GET  /api/progress?slug=xxx  → { chapter, p, updated_at }（无记录则 {}）
// PUT  /api/progress?slug=xxx  { chapter, p } → { ok }
// 归属键 = 请求头 X-Sy-Id（匿名 pid）。存 KV：progress:<pid>:<slug>

const kvKey = (pid: string, slug: string) => `progress:${pid}:${slug}`;
const validSlug = (s: string | null): string => (s && s.length <= 200 ? s : '');

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const pid = pidFromRequest(request);
  if (!pid) return json({});
  const slug = validSlug(new URL(request.url).searchParams.get('slug')?.trim() || '');
  if (!slug) return jsonError(400, '缺少 slug');
  const raw = await env.KV.get(kvKey(pid, slug));
  if (!raw) return json({});
  try {
    return json(JSON.parse(raw));
  } catch {
    return json({});
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const pid = pidFromRequest(request);
  if (!pid) return jsonError(401, '缺少身份');

  const slug = validSlug(new URL(request.url).searchParams.get('slug')?.trim() || '');
  if (!slug) return jsonError(400, '缺少 slug');

  let body: { chapter?: unknown; p?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, '无效请求体');
  }

  const chapter = Number.isFinite(body.chapter as number)
    ? Math.max(0, Math.min(999, Math.floor(body.chapter as number)))
    : 0;
  const pNum = Number(body.p);
  const p = Number.isFinite(pNum) ? Math.max(0, Math.min(100, pNum)) : 0;

  const value = JSON.stringify({
    chapter,
    p: Math.round(p * 100) / 100,
    updated_at: new Date().toISOString(),
  });
  await env.KV.put(kvKey(pid, slug), value);
  return json({ ok: true });
};
