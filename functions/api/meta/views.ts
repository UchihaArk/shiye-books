import { json } from '../../_lib/response';
import type { Env } from '../../_lib/types';

// GET /api/meta/views?slugs=a,b,c
// 批量取阅读量，返回 { <slug>: count }（未记录的 slug 不出现，前端按 0 处理）。
// 列表页一次请求取所有卡片阅读量，避免 N 次请求。
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const slugsParam = new URL(request.url).searchParams.get('slugs') || '';
  const slugs = slugsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (slugs.length === 0) return json({});

  const placeholders = slugs.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT essay_slug, count FROM sy_views WHERE essay_slug IN (${placeholders})`
  )
    .bind(...slugs)
    .all<{ essay_slug: string; count: number }>();

  const out: Record<string, number> = {};
  for (const r of result.results || []) out[r.essay_slug] = r.count;
  return json(out);
};
