/**
 * Worker 入口：把 /api/* 路由到各处理函数，其余请求交给静态资源绑定（SPA 回退由 assets 处理）。
 * 这样可继续用 `wrangler deploy`（Worker 部署），无需切到 Pages。
 */
import type { Env } from '../functions/_lib/types';
import { onRequestPost as statsView } from '../functions/api/stats/view';
import { onRequestGet as metaViews } from '../functions/api/meta/views';
import { onRequestGet as progressGet, onRequestPut as progressPut } from '../functions/api/progress/index';
import { onRequestGet as commentsGet, onRequestPost as commentsPost } from '../functions/api/comments/index';
import { onRequestGet as commentsCounts } from '../functions/api/comments/counts';
import { onRequestDelete as commentDelete } from '../functions/api/comments/[id]';

interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

type Ctx = { request: Request; env: WorkerEnv; params: Record<string, string> };

function mkCtx(request: Request, env: WorkerEnv, params: Record<string, string> = {}): Ctx {
  return { request, env, params };
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === '/api/stats/view' && method === 'POST') return await (statsView as (c: Ctx) => Promise<Response>)(mkCtx(request, env));
      if (path === '/api/meta/views' && method === 'GET') return await (metaViews as (c: Ctx) => Promise<Response>)(mkCtx(request, env));
      if (path === '/api/progress' && method === 'GET') return await (progressGet as (c: Ctx) => Promise<Response>)(mkCtx(request, env));
      if (path === '/api/progress' && method === 'PUT') return await (progressPut as (c: Ctx) => Promise<Response>)(mkCtx(request, env));
      if (path === '/api/comments' && method === 'GET') return await (commentsGet as (c: Ctx) => Promise<Response>)(mkCtx(request, env));
      if (path === '/api/comments' && method === 'POST') return await (commentsPost as (c: Ctx) => Promise<Response>)(mkCtx(request, env));
      if (path === '/api/comments/counts' && method === 'GET') return await (commentsCounts as (c: Ctx) => Promise<Response>)(mkCtx(request, env));
      const m = path.match(/^\/api\/comments\/(.+)$/);
      if (m && method === 'DELETE') {
        return await (commentDelete as (c: Ctx) => Promise<Response>)(mkCtx(request, env, { id: decodeURIComponent(m[1]) }));
      }
      if (path.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: 'server error', detail: msg }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    // 非 API 请求 → 静态资源（assets 绑定按 not_found_handling=SPA 处理回退）
    return env.ASSETS.fetch(request);
  },
};
