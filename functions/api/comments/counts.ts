import { json, jsonError } from '../../_lib/response';
import type { Env } from '../../_lib/types';

// GET /api/comments/counts?essay= → { <paragraph_id>: count }
// 渲染段落气泡数字用。只计 status='visible'。
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const essay = new URL(request.url).searchParams.get('essay')?.trim() || '';
  if (!essay) return jsonError(400, '缺少 essay');

  const result = await env.DB.prepare(
    `SELECT paragraph_id, COUNT(*) AS c FROM sy_comments
     WHERE essay_slug=? AND status='visible' GROUP BY paragraph_id`
  )
    .bind(essay)
    .all<{ paragraph_id: string; c: number }>();

  const out: Record<string, number> = {};
  for (const r of result.results || []) out[r.paragraph_id] = r.c;
  return json(out);
};
