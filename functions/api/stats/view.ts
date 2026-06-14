import { json, jsonError } from '../../_lib/response';
import type { Env } from '../../_lib/types';

// POST /api/stats/view  { slug }
// 每次进入文章 +1（不去重）。返回自增后的最新计数。
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: { slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, '无效请求体');
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  if (!slug || slug.length > 200) {
    return jsonError(400, '缺少 slug');
  }

  // 单语句原子自增，RETURNING 取回新值（D1 支持 RETURNING）。
  const row = await env.DB.prepare(
    `INSERT INTO sy_views (essay_slug, count) VALUES (?, 1)
     ON CONFLICT(essay_slug) DO UPDATE SET count = count + 1
     RETURNING count`
  )
    .bind(slug)
    .first<{ count: number }>();

  return json({ count: row?.count ?? 1 });
};
