import { json, jsonError } from '../../_lib/response';
import { clientIp } from '../../_lib/request';
import { rateLimit } from '../../_lib/ratelimit';
import type { Env, CommentOut } from '../../_lib/types';

const MAX_CONTENT = 500;

/** 取某文章的合法段落锚点集合（通过 ASSETS 绑定读静态 essay JSON 的 pids 字段，避免自 fetch 路由回环）。 */
async function getEssayPids(env: Env, essay: string): Promise<Set<string> | null> {
  try {
    const r = await env.ASSETS.fetch(
      new Request(`https://shiye.local/api/essay/${encodeURIComponent(essay)}.json`)
    );
    if (!r.ok) return null;
    const data = (await r.json()) as { pids?: string[] };
    return Array.isArray(data.pids) ? new Set(data.pids) : null;
  } catch {
    return null;
  }
}

// GET /api/comments?essay=&pid=<paragraph_id>&limit=&before=
// 返回 { items:[{id,content,created_at}], hasMore }（最新在前，游标 before=上一批最早 id）
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const u = new URL(request.url);
  const essay = u.searchParams.get('essay')?.trim() || '';
  const paragraphId = u.searchParams.get('pid')?.trim() || '';
  if (!essay || !paragraphId) return jsonError(400, '缺少 essay 或 pid');

  const limit = Math.min(Math.max(parseInt(u.searchParams.get('limit') || '50', 10) || 50, 1), 100);
  const before = parseInt(u.searchParams.get('before') || '0', 10) || 0;

  const stmt = before
    ? env.DB.prepare(
        `SELECT id, content, created_at FROM sy_comments
         WHERE essay_slug=? AND paragraph_id=? AND status='visible' AND id<?
         ORDER BY id DESC LIMIT ?`
      ).bind(essay, paragraphId, before, limit + 1)
    : env.DB.prepare(
        `SELECT id, content, created_at FROM sy_comments
         WHERE essay_slug=? AND paragraph_id=? AND status='visible'
         ORDER BY id DESC LIMIT ?`
      ).bind(essay, paragraphId, limit + 1);

  const result = await stmt.all<{ id: number; content: string; created_at: string }>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const items: CommentOut[] = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    id: r.id,
    content: r.content,
    created_at: r.created_at,
  }));
  return json({ items, hasMore });
};

// POST /api/comments { essay, pid, content } → { id, created_at }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const ip = clientIp(request);

  // 限流：每 IP 每分钟 10 条
  const allowed = await rateLimit(env.KV, `cmt:ip:${ip}`, 10, 60);
  if (!allowed) return jsonError(429, '发言过快，请稍后再试');

  let body: { essay?: unknown; pid?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, '无效请求体');
  }

  const essay = typeof body.essay === 'string' ? body.essay.trim() : '';
  const paragraphId = typeof body.pid === 'string' ? body.pid.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!essay || essay.length > 200) return jsonError(400, '缺少 essay');
  if (!paragraphId) return jsonError(400, '缺少 pid');
  if (!content) return jsonError(400, '内容不能为空');
  if (content.length > MAX_CONTENT) return jsonError(400, `内容过长（≤${MAX_CONTENT}字）`);

  // 校验段落属于该文章（防随意挂载）
  const pids = await getEssayPids(env, essay);
  if (!pids || !pids.has(paragraphId)) return jsonError(400, '无效段落');

  const row = await env.DB.prepare(
    `INSERT INTO sy_comments (essay_slug, paragraph_id, content) VALUES (?, ?, ?)
     RETURNING id, created_at`
  )
    .bind(essay, paragraphId, content)
    .first<{ id: number; created_at: string }>();

  return json({ id: row?.id, created_at: row?.created_at || '' });
};
