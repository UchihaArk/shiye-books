import { useRef, useCallback, useState, useEffect } from 'react';
import { loadEssayContent } from '../lib/contentLoader';
import { postView, formatCount, getProgress, saveProgress } from '../lib/api';
import { isUnlocked as checkUnlocked } from '../lib/secrets';
import TOC from './TOC';
import ProgressBar from './ProgressBar';
import BackToTop from './BackToTop';
import ImageLightbox from './ImageLightbox';
import ParagraphComments from './ParagraphComments';

const FONT_KEY = 'sy-font-level';
const THEME_KEY = 'sy-theme';
const FONT_LEVELS = [
  { label: 'A', cls: 'font-sm', title: '小' },
  { label: 'A', cls: 'font-md', title: '中' },
  { label: 'A', cls: 'font-lg', title: '大' },
];

const READING_THEMES = [
  { key: 'oriental', name: '书卷', swatch: '#F5EFE4' },
  { key: 'magazine', name: '杂志', swatch: '#FFF' },
  { key: 'night', name: '暗夜', swatch: '#262220' },
];

const themeIconPaths = {
  oriental: (
    <>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </>
  ),
  magazine: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </>
  ),
  night: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
};

export default function ReadingView({ essayId, onBack, essays, essayOrder, onUnlock, theme, onThemeChange }) {
  const containerRef = useRef(null);
  const articleRef = useRef(null);
  const topRef = useRef(null);
  const fontBtnRef = useRef(null);
  const viewedRef = useRef(null);
  const chapterIdxRef = useRef(0);
  const isRestoringRef = useRef(false);
  const pendingRestoreRef = useRef(null);
  const lastSaveRef = useRef(0);
  const [topScrolled, setTopScrolled] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [fontLevel, setFontLevel] = useState(() => {
    const saved = parseInt(localStorage.getItem(FONT_KEY), 10);
    return saved >= 0 && saved <= 2 ? saved : 1;
  });
  const readingTheme = theme || 'oriental'; // unified from App
  const [fontToast, setFontToast] = useState(false);

  // Async content state
  const [contentData, setContentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Image lightbox state
  const [lightbox, setLightbox] = useState({ src: null, alt: null });

  // 阅读量（进入文章时由 postView 返回）
  const [viewCount, setViewCount] = useState(null);

  // 批注开关（顶部工具栏，默认关）
  const [commentsEnabled, setCommentsEnabled] = useState(false);

  const essay = essays[essayId];
  const hasChapters = essay && essay.chapters && essay.chapters.length > 0;
  const isLocked = essay?.locked && !checkUnlocked(essayId);
  chapterIdxRef.current = chapterIdx; // 供异步回调读取最新章节

  // 恢复阅读位置（内容加载后由双 rAF 触发，确保新章节已绘制）
  const restoreScroll = useCallback(() => {
    const container = containerRef.current;
    const p = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    if (!container) { isRestoringRef.current = false; return; }
    if (p == null) {
      container.scrollTo(0, 0);
    } else {
      const dh = container.scrollHeight - container.clientHeight;
      container.scrollTo(0, dh > 0 ? Math.min(Math.round((p / 100) * dh), dh) : 0);
    }
    isRestoringRef.current = false;
  }, []);

  // Lock body scroll while reading view is mounted
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Load content when essay changes; restore reading progress (chapter + scroll)
  useEffect(() => {
    if (!essayId || isLocked) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChapterIdx(0);
    setViewCount(null);
    isRestoringRef.current = true; // 抑制 chapterIdx 切换的置顶，交由 restore 处理

    // 记录一次阅读（StrictMode 双调用守卫）
    if (viewedRef.current !== essayId) {
      viewedRef.current = essayId;
      postView(essayId).then((c) => {
        if (!cancelled && c != null) setViewCount(c);
      });
    }

    loadEssayContent(essayId)
      .then(async (data) => {
        if (cancelled) return;
        setContentData(data);
        setLoading(false);

        // 恢复章节：URL hash（显式跳转）优先，否则取云端进度
        const hashM = window.location.hash.match(/^#c-(\d+)$/);
        const total = (data.chapters || []).length;
        let ch = 0;
        let restoreP = null; // null → 置顶；数值 → 滚到该百分比
        if (hashM) {
          const ci = parseInt(hashM[1], 10) - 1; // 1-based → 0-based
          if (total > 0 && ci >= 0 && ci < total) ch = ci;
        } else {
          const prog = await getProgress(essayId);
          if (cancelled) return;
          if (prog) {
            if (total > 0 && typeof prog.chapter === 'number' && prog.chapter >= 0 && prog.chapter < total) ch = prog.chapter;
            if (typeof prog.p === 'number') restoreP = prog.p;
          }
        }
        chapterIdxRef.current = ch;
        isRestoringRef.current = true;
        setChapterIdx(ch);
        // 双 rAF 等 React 提交并绘制新章节内容后再恢复滚动
        pendingRestoreRef.current = restoreP;
        requestAnimationFrame(() => requestAnimationFrame(restoreScroll));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [essayId, isLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach click-to-zoom on article images
  useEffect(() => {
    const el = articleRef.current;
    if (!el || loading || error) return;

    const handler = (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      setLightbox({ src: img.src, alt: img.alt || '' });
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [contentData, loading, error]);

  // Scroll to top when essay changes
  useEffect(() => {
    containerRef.current?.scrollTo(0, 0);
  }, [essayId]);

  // Scroll to top when chapter changes (manual nav) — restore 期间跳过
  useEffect(() => {
    if (isRestoringRef.current) return;
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [chapterIdx]);

  // Listen for hashchange (browser back/forward with chapter hashes)
  useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.match(/^#c-(\d+)$/);
      if (m) {
        const ci = parseInt(m[1], 10) - 1; // 1-based in URL → 0-based index
        const total = (contentData?.chapters || []).length;
        if (total > 0 && ci >= 0 && ci < total && ci !== chapterIdx) {
          setChapterIdx(ci);
        }
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [contentData, chapterIdx]);

  // Scroll detection for sticky top bar + progress + back-to-top — rAF throttled
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let raf = 0, ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        const st = container.scrollTop;
        setTopScrolled(st > 80);
        const dh = container.scrollHeight - container.clientHeight;
        setShowBackTop(st > 400 && st < dh - 40);
        const ratio = dh > 0 ? Math.min((st / dh) * 100, 100) : 0;
        setReadingProgress(ratio);
        // 节流保存阅读进度（≥2s 一次）
        const now = Date.now();
        if (now - lastSaveRef.current >= 2000) {
          lastSaveRef.current = now;
          saveProgress(essayId, chapterIdxRef.current, ratio);
        }
        ticking = false;
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [essayId]);

  // 离开文章 / 页面隐藏时落盘最新进度
  useEffect(() => {
    const flush = () => {
      const container = containerRef.current;
      if (!container) return;
      const dh = container.scrollHeight - container.clientHeight;
      const ratio = dh > 0 ? Math.min((container.scrollTop / dh) * 100, 100) : 0;
      saveProgress(essayId, chapterIdxRef.current, ratio);
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush(); // 切换文章 / 卸载时保存
    };
  }, [essayId]);

  // Hide system header immediately when reading view mounts
  useEffect(() => {
    const header = document.querySelector('.header');
    if (header) header.classList.add('header-hidden');
    if (containerRef.current) containerRef.current.classList.add('no-header');
    return () => {
      if (header) header.classList.remove('header-hidden');
      if (containerRef.current) containerRef.current.classList.remove('no-header');
    };
  }, []);

  if (!essay) return null;

  const idx = essayOrder.indexOf(essayId);
  const prevEssay = idx > 0 ? essays[essayOrder[idx - 1]] : null;
  const nextEssay = idx < essayOrder.length - 1 ? essays[essayOrder[idx + 1]] : null;

  // Resolve display content from loaded data
  let displayContent = '';
  let chapterLabel = '';
  if (contentData) {
    const chapters = contentData.chapters || [];
    if (chapters.length > 0 && chapters[chapterIdx]) {
      displayContent = chapters[chapterIdx].content;
      chapterLabel = `${chapterIdx + 1} / ${chapters.length}`;
    } else {
      displayContent = contentData.content || '';
    }
  }

  const handleNav = useCallback(
    (id) => {
      const event = new CustomEvent('open-essay', { detail: id });
      window.dispatchEvent(event);
    },
    []
  );

  const handleChapterNav = useCallback(
    (newIdx) => {
      setChapterIdx(newIdx);
      // Update URL hash without creating history entries (1-based)
      if (newIdx > 0) {
        window.history.replaceState(null, '', `#c-${newIdx + 1}`);
      } else {
        window.history.replaceState(null, '', window.location.pathname);
      }
    },
    []
  );

  // Determine chapter title for sticky bar
  const currentChapterTitle = contentData?.chapters?.length > 0 && contentData.chapters[chapterIdx]
    ? contentData.chapters[chapterIdx].title
    : '';

  // Build chapter pill items with ellipsis for large chapter counts
  const buildChapterPills = () => {
    const chapters = contentData?.chapters || essay.chapters || [];
    const total = chapters.length;
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => ({ idx: i, type: 'pill' }));
    }
    const items = [];
    const add = (i) => items.push({ idx: i, type: 'pill' });
    const dots = () => items.push({ idx: -1, type: 'dots' });

    add(0);
    if (chapterIdx <= 2) {
      add(1); add(2);
      if (chapterIdx === 2) add(3);
      dots();
    } else if (chapterIdx >= total - 3) {
      dots();
      if (chapterIdx === total - 3) add(total - 4);
      add(total - 3); add(total - 2);
    } else {
      dots();
      add(chapterIdx - 1); add(chapterIdx); add(chapterIdx + 1);
      dots();
    }

    const lastItem = items[items.length - 1];
    if (lastItem.type === 'dots' || lastItem.idx !== total - 1) {
      if (lastItem.type === 'dots' && items.length > 1 && items[items.length - 2].idx === total - 1) {
        items.pop();
      } else {
        add(total - 1);
      }
    }
    if (items.length > 1 && items[0].idx === items[1].idx) {
      items.splice(0, 1);
    }
    return items;
  };

  // Build bottom navigation for chaptered articles
  const renderNav = () => {
    const chapters = contentData?.chapters || essay.chapters || [];
    const isChaptered = chapters.length > 0;

    if (isChaptered) {
      const isFirstChapter = chapterIdx === 0;
      const isLastChapter = chapterIdx === chapters.length - 1;

      return (
        <div className="nav">
          {isFirstChapter ? (
            prevEssay ? (
              <div className="navBtn" onClick={() => handleNav(essayOrder[idx - 1])}>
                <span className="nl">← 上一篇</span>
                <span className="nt">{prevEssay.title}</span>
              </div>
            ) : <div />
          ) : (
            <div className="navBtn" onClick={() => handleChapterNav(chapterIdx - 1)}>
              <span className="nl">← 上一章</span>
              <span className="nt">{chapters[chapterIdx - 1].title}</span>
            </div>
          )}

          {isLastChapter ? (
            nextEssay ? (
              <div className="navBtn next" onClick={() => handleNav(essayOrder[idx + 1])}>
                <span className="nl">下一篇 →</span>
                <span className="nt">{nextEssay.title}</span>
              </div>
            ) : <div />
          ) : (
            <div className="navBtn next" onClick={() => handleChapterNav(chapterIdx + 1)}>
              <span className="nl">下一章 →</span>
              <span className="nt">{chapters[chapterIdx + 1].title}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="nav">
        {prevEssay && (
          <div className="navBtn" onClick={() => handleNav(essayOrder[idx - 1])}>
            <span className="nl">← 上一篇</span>
            <span className="nt">{prevEssay.title}</span>
          </div>
        )}
        {nextEssay && (
          <div className="navBtn next" onClick={() => handleNav(essayOrder[idx + 1])}>
            <span className="nl">下一篇 →</span>
            <span className="nt">{nextEssay.title}</span>
          </div>
        )}
      </div>
    );
  };

  // Chapter info: prefer loaded content data (has titles), fallback to meta
  const chapterList = contentData?.chapters || essay.chapters || [];

  return (
    <div className="reading vis" ref={containerRef}>
      <ProgressBar progress={readingProgress} />
      <BackToTop visible={showBackTop} scrollContainer={containerRef} />
      {!isLocked && !loading && !error && (
        <TOC contentRef={articleRef} essayId={essayId} chapterIdx={chapterIdx} scrollContainerRef={containerRef} />
      )}
      <div className="readingWrap">
        <div className="readingInner">
          <div className={`rdTop${topScrolled ? ' scrolled' : ''}`} ref={topRef}>
            <div className="rdTopLeft">
              <button className="rdBack" onClick={onBack} title="返回列表">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
              </button>
              <div className={`rdStickyTitle${topScrolled ? ' vis' : ''}`}>
                <span className="rdStickyTitleText">{essay.title}</span>
                {hasChapters && currentChapterTitle && (
                  <span className="rdStickyChapter"> · {currentChapterTitle}</span>
                )}
                {hasChapters && chapterLabel && (
                  <span className="rdChLabel">{chapterLabel}</span>
                )}
              </div>
            </div>
            <div className="rdTopR">
              <button
                className="rdCommentToggle"
                onClick={() => setCommentsEnabled((v) => !v)}
                title={commentsEnabled ? '关闭批注' : '查看批注'}
                aria-label={commentsEnabled ? '关闭批注' : '查看批注'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  {!commentsEnabled && <line x1="5" y1="19" x2="19" y2="5" />}
                </svg>
              </button>
              <div className="fontToggleWrap">
                <button
                  ref={fontBtnRef}
                  className="fontToggle"
                  onClick={() => {
                    const next = (fontLevel + 1) % 3;
                    setFontLevel(next);
                    localStorage.setItem(FONT_KEY, next);
                    setFontToast(true);
                    setTimeout(() => setFontToast(false), 1000);
                    if (fontBtnRef.current) fontBtnRef.current.blur();
                  }}
                >
                  {FONT_LEVELS.map((fl, i) => (
                    <span key={i} className={`ftDot${i === fontLevel ? ' active' : ''}`} />
                  ))}
                </button>
                <span className={`fontHint${fontToast ? ' show' : ''}`}>字号：{FONT_LEVELS[fontLevel].title}</span>
              </div>
              <button
                className="rdThemeBtn"
                onClick={() => {
                  const keys = READING_THEMES.map(t => t.key);
                  const idx = keys.indexOf(readingTheme);
                  const next = keys[(idx + 1) % keys.length];
                  onThemeChange?.(next);
                }}
                title="切换主题"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  {themeIconPaths[readingTheme] || themeIconPaths.oriental}
                </svg>
              </button>
            </div>
          </div>

          <h1 className="rdTitle">{essay.title}</h1>

          <div className="rdMeta">
            <span className="rdDate">{essay.date} · {essay.category}{essay.author ? ` · ${essay.author}` : ''}{essay.time ? ` · ${essay.time}` : ''}</span>
            {viewCount != null && !isLocked && (
              <span className="rdViews">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {formatCount(viewCount)} 次阅读
              </span>
            )}
            <div className="rdTags">
              {essay.tags.map((t) => (
                <span key={t} className="rdTag">{t}</span>
              ))}
            </div>
          </div>

          {essay.cover && !isLocked && (
            <div className="rdCover" onClick={() => setLightbox({ src: essay.cover, alt: essay.title })}>
              <img src={essay.cover} alt={essay.title} />
            </div>
          )}

          {/* Locked content gate */}
          {isLocked ? (
            <div className="rdLocked">
              <span className="rdLockedIcon">🔒</span>
              <h3 className="rdLockedTitle">这篇文章需要暗号解锁</h3>
              <p className="rdLockedHint">输入正确的暗号才能阅读全文</p>
              <button className="rdLockedBtn" onClick={() => onUnlock?.(essayId)}>
                输入暗号
              </button>
            </div>
          ) : (
            <>
              {/* Chapter navigation bar */}
              {hasChapters && chapterList.length > 0 && (
                <div className="rdChapterBar">
                  <span className="rdChapterTitle">
                    {chapterList[chapterIdx]?.title || ''}
                  </span>
                  <div className="rdChapterPills">
                    {buildChapterPills().map((item, i) =>
                      item.type === 'dots' ? (
                        <span key={`d${i}`} className="rdChDots">…</span>
                      ) : (
                        <button
                          key={item.idx}
                          className={`rdChPill${item.idx === chapterIdx ? ' active' : ''}`}
                          onClick={() => handleChapterNav(item.idx)}
                        >
                          {item.idx + 1}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Content area */}
              {loading ? (
                <div className="rdLoading">
                  <div className="rdLoadingSpinner" />
                  <span>正在加载…</span>
                </div>
              ) : error ? (
                <div className="rdError">
                  <span>加载失败：{error}</span>
                  <button onClick={() => window.location.reload()}>重试</button>
                </div>
              ) : (
                <>
                  <div
                    ref={articleRef}
                    className={`article ${FONT_LEVELS[fontLevel].cls}`}
                    dangerouslySetInnerHTML={{ __html: displayContent }}
                  />
                  <ParagraphComments
                    essayId={essayId}
                    articleRef={articleRef}
                    contentKey={`${essayId}:${chapterIdx}`}
                    enabled={commentsEnabled}
                  />
                  {renderNav()}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {lightbox.src && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox({ src: null, alt: null })}
        />
      )}
    </div>
  );
}
