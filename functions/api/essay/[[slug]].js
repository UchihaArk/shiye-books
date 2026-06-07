/**
 * Cloudflare Pages Function — 反代 /api/essay/*.json
 * 使用 [[slug]] 通配路由匹配任意文章 slug。
 * 从 GitHub Raw 实时拉取数据，绕过 CDN 缓存延迟。
 */

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/UchihaArk/shiye-books/master/dist/api/essay';

export async function onRequest(context) {
  // 从 URL 中提取 slug：/api/essay/some-slug.json → some-slug
  const { pathname } = new URL(context.request.url);
  const match = pathname.match(/\/api\/essay\/(.+)\.json$/);
  const slug = match ? match[1] : null;

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Invalid slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = `${GITHUB_RAW_BASE}/${encodeURIComponent(slug)}.json?t=${Date.now()}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'shiye-pages-function' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Upstream error', status: res.status }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // 文章内容较稳定，浏览器缓存 5 分钟
        'CDN-Cache-Control': 'public, max-age=120', // Cloudflare 边缘缓存 2 分钟
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
