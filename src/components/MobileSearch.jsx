import { useState, useRef, useEffect, useMemo } from 'react';

function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function MobileSearch({
  open,
  searchQuery,
  onSearch,
  onSelectTag,
  onClose,
  onSelectEssay,
  allTags,
  allEssays,
  essayOrder,
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [randomTags, setRandomTags] = useState(() => pickRandom(allTags || [], 8));
  const inputRef = useRef(null);
  const pageRef = useRef(null);

  const tagSuggestions = localQuery.trim()
    ? (allTags || []).filter((t) =>
        t.toLowerCase().includes(localQuery.trim().toLowerCase())
      )
    : showSuggestions
      ? randomTags
      : [];

  // Real-time preview: filter essays matching localQuery
  const previewResults = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    if (!q) return [];
    let list = (essayOrder || []).map((id) => allEssays?.[id]).filter(Boolean);
    return list.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.author?.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [localQuery, allEssays, essayOrder]);

  // Open keyboard on mount
  useEffect(() => {
    if (open) {
      setLocalQuery(searchQuery || '');
      setRandomTags(pickRandom(allTags || [], 8));
      setShowSuggestions(false);
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.click();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    const q = localQuery.trim();
    if (q) {
      onSearch(q);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelectTag = (tag) => {
    onSelectTag(tag);
    onClose();
  };

  const handleSelectEssay = (id) => {
    onClose();
    // Small delay to let search page close first
    setTimeout(() => onSelectEssay(id), 50);
  };

  // Click on backdrop (empty area) to close
  const handlePageClick = (e) => {
    if (e.target === pageRef.current) {
      onClose();
    }
  };

  // Prevent body scroll when search page is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const hasQuery = localQuery.trim().length > 0;

  return (
    <div className="mobileSearchPage" ref={pageRef} onClick={handlePageClick}>
      {/* Top bar: back + input + search button */}
      <div className="mobileSearchBar" onClick={(e) => e.stopPropagation()}>
        <button className="mobileSearchBack" onClick={onClose} aria-label="返回">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="mobileSearchInputWrap">
          <svg className="mobileSearchInputIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索文章或标签…"
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setRandomTags(pickRandom(allTags || [], 8));
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {localQuery && (
            <button className="mobileSearchClear" onClick={() => { setLocalQuery(''); inputRef.current?.focus(); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button className="mobileSearchBtn" onClick={handleSearch}>
          搜索
        </button>
      </div>

      {/* Content area — scrollable */}
      <div className="mobileSearchContent">
        {/* Preview results when typing */}
        {hasQuery && previewResults.length > 0 && (
          <div className="mobileSearchResults">
            <div className="mobileSearchResultsLabel">
              找到 {previewResults.length} 篇相关文章
            </div>
            {previewResults.map((e) => (
              <button
                key={e.id}
                className="mobileSearchResult"
                onClick={() => handleSelectEssay(e.id)}
              >
                <span className="mobileSearchResultTitle">{e.title}</span>
                <span className="mobileSearchResultMeta">
                  {e.author && <>{e.author} · </>}
                  {e.category}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {hasQuery && previewResults.length === 0 && (
          <div className="mobileSearchHint">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" width="40" height="40" opacity="0.3">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p>未找到相关文章</p>
          </div>
        )}

        {/* Tag suggestions when no query or query matches tags */}
        {!hasQuery && showSuggestions && tagSuggestions.length > 0 && (
          <div className="mobileSearchTags">
            <div className="mobileSearchTagsLabel">热门标签</div>
            <div className="mobileSearchTagsList">
              {tagSuggestions.map((tag) => (
                <button
                  key={tag}
                  className="mobileSearchTag"
                  onClick={() => handleSelectTag(tag)}
                >
                  <span className="tagSugIcon">#</span>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasQuery && !showSuggestions && (
          <div className="mobileSearchHint">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" width="40" height="40" opacity="0.3">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p>输入关键词搜索文章标题、摘要或标签</p>
          </div>
        )}
      </div>
    </div>
  );
}
