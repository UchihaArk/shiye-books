import { useRef, useCallback, useState, useEffect } from 'react';
import { loadEssayContent } from '../lib/contentLoader';
import { isUnlocked as checkUnlocked } from '../lib/secrets';
import TOC from './TOC';
import ImageLightbox from './ImageLightbox';

const FONT_KEY = 'sy-font-level';
const FONT_LEVELS = [
  { label: 'A', cls: 'font-sm', title: '小' },
  { label: 'A', cls: 'font-md', title: '中' },
  { label: 'A', cls: 'font-lg', title: '大' },
];

export default function ReadingView({ essayId, onBack, onToggleImmersive, essays, essayOrder, onUnlock }) {
  const articleRef = useRef(null);
  const topRef = useRef(null);
  const [topScrolled, setTopScrolled] = useState(false);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [fontLevel, setFontLevel] = useState(() => {
    const saved = parseInt(localStorage.getItem(FONT_KEY), 10);
    return saved >= 0 && saved <= 2 ? saved : 1; // default: medium
  });

  // Async content state
  const [contentData, setContentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Image lightbox state
  const [lightbox, setLightbox] = useState({ src: null, alt: null });

  const essay = essays[essayId];
  const hasChapters = essay && essay.chapters && essay.chapters.length > 0;
  const isLocked = essay?.locked && !checkUnlocked(essayId);

  // Load content when essay changes
  useEffect(() => {
    if (!essayId || isLocked) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChapterIdx(0);

    loadEssayContent(essayId)
      .then((data) => {
        if (!cancelled) {
          setContentData(data);
          setLoading(false);
          // Restore chapter from URL hash (e.g. #c-2 → second chapter)
          const hash = window.location.hash;
          const m = hash.match(/^#c-(\d+)$/);
          if (m) {
            const ci = parseInt(m[1], 10) - 1; // 1-based in URL → 0-based index
            const total = (data.chapters || []).length;
            if (total > 0 && ci >= 0 && ci < total) {
              setChapterIdx(ci);
            }
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [essayId, isLocked]);

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
    window.scrollTo(0, 0);
  }, [essayId]);

  // Scroll to top when chapter changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Scroll detection for sticky top bar
  useEffect(() => {
    const onScroll = () => {
      setTopScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [essayId]);

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

  /**
   * Build chapter pill items with ellipsis for large chapter counts.
   */
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
    <div className="reading vis">
      {!isLocked && !loading && !error && (
        <TOC contentRef={articleRef} essayId={essayId} chapterIdx={chapterIdx} />
      )}
      <div className="readingWrap">
        <div className="readingInner">
          <div className={`rdTop${topScrolled ? ' scrolled' : ''}`} ref={topRef}>
            <button className="rdBack" onClick={onBack}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
              返回
            </button>
            <div className="rdTopR">
              {hasChapters && chapterLabel && (
                <span className="rdChLabel">{chapterLabel}</span>
              )}
              <div className="fontToggleWrap">
                <button
                  className="fontToggle"
                  onClick={() => {
                    const next = (fontLevel + 1) % 3;
                    setFontLevel(next);
                    localStorage.setItem(FONT_KEY, next);
                  }}
                >
                  {FONT_LEVELS.map((fl, i) => (
                    <span key={i} className={`ftDot${i === fontLevel ? ' active' : ''}`} />
                  ))}
                </button>
                <span className="fontHint">字号：{FONT_LEVELS[fontLevel].title}</span>
              </div>
              <span className="rdEst">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {essay.time}
              </span>
              <button className="immersiveEntry" onClick={onToggleImmersive} style={{ display: 'flex' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                沉浸阅读
              </button>
            </div>
          </div>

          <h1 className="rdTitle">{essay.title}</h1>

          <div className="rdMeta">
            <span className="rdDate">{essay.date} · {essay.category}{essay.author ? ` · ${essay.author}` : ''}</span>
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
