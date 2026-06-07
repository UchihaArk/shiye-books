/**
 * Cloudflare Pages Function — 反代 /api/index.json
 * 从 GitHub Raw 实时拉取数据，绕过 CDN 缓存延迟。
 */

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/UchihaArk/shiye-books/master/dist/api';

export async function onRequest(context) {
  const url = `${GITHUB_RAW_BASE}/index.json?t=${Date.now()}`;

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
        'Cache-Control': 'public, max-age=60', // 浏览端缓存 60 秒，之后重新验证
        'CDN-Cache-Control': 'public, max-age=30', // Cloudflare 边缘缓存 30 秒
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
