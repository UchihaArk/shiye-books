-- shiye-books · 初始 schema（阅读量 + 片段书评）
-- 所有表加 sy_ 前缀，避免与该 D1 库中的其他表冲突。
-- 幂等：可重复执行。

-- 阅读量：纯计数器（每次进入文章 +1，不去重）
CREATE TABLE IF NOT EXISTS sy_views (
  essay_slug TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0
);

-- 片段书评（无署名、无作者系统：仅内容 + 时间）
CREATE TABLE IF NOT EXISTS sy_comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  essay_slug   TEXT NOT NULL,
  paragraph_id TEXT NOT NULL,                   -- 段落稳定锚点 data-pid（见 build.js）
  content      TEXT NOT NULL,                   -- 正文（服务端裁剪至 500 字）
  status       TEXT NOT NULL DEFAULT 'visible', -- visible | deleted（软删）
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sy_comments_loc
  ON sy_comments (essay_slug, paragraph_id, status, created_at DESC);
