/**
 * Pages Functions 运行时环境绑定。
 * D1/KV 来自 wrangler.toml；ADMIN_TOKEN 来自 Pages secret（仅超管删除评论用）。
 */
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ADMIN_TOKEN?: string;
}

/** 单条书评的对外结构（无署名、无 author 字段）。 */
export interface CommentOut {
  id: number;
  content: string;
  created_at: string;
}
