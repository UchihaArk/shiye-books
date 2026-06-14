import { useEffect, useState, useCallback, useRef } from 'react';
import { getCommentCounts, getComments, postComment, deleteComment } from '../lib/api';
import { isAdmin, clearAdminToken } from '../lib/admin';

const MAX = 500;

/** D1 created_at（"YYYY-MM-DD HH:MM:SS" UTC）→ 相对时间。 */
function relTime(iso) {
  if (!iso) return '';
  const t = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(t).toLocaleDateString('zh-CN');
}

function chipInnerHTML(n) {
  return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span>' + n + '</span>';
}

const TRASH_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

/** 右侧面板 / 移动端抽屉：展示某段落评论（最新在前）+ 发表 + 管理员删除。pid 变化时自动重载。 */
function CommentSidePanel({ essayId, pid, onClose, onCountChange }) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [before, setBefore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [admin, setAdmin] = useState(() => isAdmin());

  const load = useCallback(
    async (b) => {
      setLoading(true);
      const res = await getComments(essayId, pid, b);
      setItems((prev) => (b ? [...prev, ...res.items] : res.items));
      setHasMore(!!res.hasMore);
      setBefore(res.items.length ? res.items[res.items.length - 1].id : 0);
      setLoading(false);
    },
    [essayId, pid]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    setError('');
    const created = await postComment(essayId, pid, text);
    setPosting(false);
    if (!created) {
      setError('发送失败，可能发言过快，请稍后再试');
      return;
    }
    setItems((prev) => [
      { id: created.id, content: text, created_at: created.created_at },
      ...prev,
    ]);
    setDraft('');
    onCountChange?.(pid, 1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('删除这条留言？')) return;
    setError('');
    const ok = await deleteComment(id);
    if (ok) {
      setItems((prev) => prev.filter((c) => c.id !== id));
      onCountChange?.(pid, -1);
    } else {
      setError('删除失败（可能令牌已失效）');
    }
  };

  const exitAdmin = () => {
    clearAdminToken();
    setAdmin(false);
  };

  return (
    <>
      <div className="pcBackdrop" onClick={onClose} />
      <aside className="pcSide">
        <div className="pcSideHead">
          <span className="pcSideTitle">来自读者的留言</span>
          <div className="pcSideActions">
            {admin && <button className="pcAdminExit" onClick={exitAdmin}>管理中 · 退出</button>}
            <button className="pcClose" onClick={onClose} aria-label="关闭">✕</button>
          </div>
        </div>
        <div className="pcList">
          {loading ? (
            <div className="pcEmpty">加载中…</div>
          ) : items.length === 0 ? (
            <div className="pcEmpty">还没有人留言，成为第一个吧</div>
          ) : (
            items.map((c) => (
              <div key={c.id} className="pcCard">
                <div className="pcBody">{c.content}</div>
                <div className="pcCardFt">
                  <span className="pcTime">{relTime(c.created_at)}</span>
                  {admin && (
                    <button
                      className="pcDel"
                      onClick={() => handleDelete(c.id)}
                      title="删除"
                      dangerouslySetInnerHTML={{ __html: TRASH_SVG }}
                    />
                  )}
                </div>
              </div>
            ))
          )}
          {hasMore && (
            <button className="pcMore" onClick={() => load(before)} disabled={loading}>
              加载更多
            </button>
          )}
          {error && <div className="pcError">{error}</div>}
        </div>
        <div className="pcForm">
          <textarea
            className="pcTextarea"
            placeholder="写下你的看法…"
            maxLength={MAX}
            value={draft}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="pcFormFt">
            <span className="pcCnt">{draft.length}/{MAX}</span>
            <button className="pcSend" onClick={submit} disabled={posting || !draft.trim()}>
              {posting ? '发送中…' : '发送'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/**
 * 段落书评交互。enabled=false 时不注入任何东西（纯净阅读）；
 * enabled=true 时给每个 p[data-pid] 注入 💬 气泡，点击在右侧/抽屉面板
 * 展示该段评论（同时只能展示一段）。MutationObserver 兜底 React 重置 innerHTML。
 */
export default function ParagraphComments({ essayId, articleRef, contentKey, enabled }) {
  const [hosts, setHosts] = useState({}); // pid -> chipEl
  const [counts, setCounts] = useState({});
  const [activePid, setActivePid] = useState(null);
  const selectRef = useRef(null);

  // 注入 chips（仅 enabled 时）
  useEffect(() => {
    const root = articleRef.current;
    if (!enabled || !root) {
      if (root) root.querySelectorAll('p[data-pid] > .pcChip').forEach((n) => n.remove());
      setHosts({});
      return;
    }
    const ensureInjected = () => {
      const paras = root.querySelectorAll('p[data-pid]');
      const map = {};
      paras.forEach((p) => {
        const pid = p.dataset.pid;
        let chip = p.querySelector(':scope > .pcChip');
        if (!chip) {
          chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'pcChip';
          chip.innerHTML = chipInnerHTML(0);
          chip.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            selectRef.current?.(pid);
          });
          p.appendChild(chip);
        }
        map[pid] = chip;
      });
      setHosts((prev) => {
        const same =
          Object.keys(map).length === Object.keys(prev).length &&
          Object.entries(map).every(([pid, c]) => prev[pid] === c);
        return same ? prev : map;
      });
    };
    ensureInjected();
    const observer = new MutationObserver(() => ensureInjected());
    observer.observe(root, { childList: true });
    getCommentCounts(essayId).then(setCounts).catch(() => {});
    return () => {
      observer.disconnect();
      root.querySelectorAll('p[data-pid] > .pcChip').forEach((n) => n.remove());
    };
  }, [contentKey, enabled, essayId, articleRef]);

  // 计数变化 → 更新气泡数字
  useEffect(() => {
    Object.entries(hosts).forEach(([pid, chipEl]) => {
      if (chipEl) chipEl.innerHTML = chipInnerHTML(counts[pid] || 0);
    });
  }, [hosts, counts]);

  // 选中段 → 高亮对应气泡
  useEffect(() => {
    Object.entries(hosts).forEach(([pid, chipEl]) => {
      if (chipEl) chipEl.classList.toggle('active', pid === activePid);
    });
  }, [hosts, activePid]);

  // 切篇 / 关闭开关时清空选中
  useEffect(() => {
    setActivePid(null);
  }, [contentKey, enabled]);

  const handleSelect = useCallback((pid) => {
    setActivePid((prev) => (prev === pid ? null : pid));
  }, []);
  selectRef.current = handleSelect;

  const onCountChange = useCallback((pid, delta = 1) => {
    setCounts((c) => ({ ...c, [pid]: Math.max(0, (c[pid] || 0) + delta) }));
  }, []);

  if (!enabled) return null;

  return activePid ? (
    <CommentSidePanel
      essayId={essayId}
      pid={activePid}
      onClose={() => setActivePid(null)}
      onCountChange={onCountChange}
    />
  ) : null;
}
