import { useState, useRef, useEffect } from 'react';
import CardGrid from './CardGrid';

function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export default function ListView({
  title,
  subtitle,
  showClear,
  onClear,
  essays,
  onSelectEssay,
  activeTags,
  onRemoveTag,
  onTagClick,
  onSearch,
  onSelectTag,
  searchQuery,
  allTags,
  isUnlocked,
  onLockedClick,
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [randomTags, setRandomTags] = useState(() => pickRandom(allTags || [], 5));
  const inputRef = useRef(null);

  const suggestions = (searchQuery || '').trim()
    ? (allTags || []).filter((t) =>
        t.toLowerCase().includes((searchQuery || '').trim().toLowerCase())
      )
    : showSuggestions
      ? randomTags
      : [];

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (inputRef.current && !inputRef.current.closest('.listSearchBox')?.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  return (
    <div className="listView">
      <div className="listHdr">
        <div className="listHdrRow">
          <h2>{title}</h2>
          <div className="listHdrActions">
            {/* Search icon button — opens inline search on mobile, shown when no filter active */}
            {!showClear && !mobileSearchOpen && (
              <button
                className="listSearchToggle"
                onClick={() => {
                  setMobileSearchOpen(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                title="搜索"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            )}
            {/* Clear filter button */}
            <button
              className={`clearBtn${showClear ? ' vis' : ''}`}
              onClick={onClear}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              清除筛选
            </button>
          </div>
        </div>
        {/* Inline search bar — replaces subtitle row when open */}
        {mobileSearchOpen && (
          <div className="listSearchBox">
            <svg className="listSearchIcon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索文章或标签…"
              value={searchQuery || ''}
              onChange={(e) => {
                onSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setRandomTags(pickRandom(allTags || [], 5));
                setShowSuggestions(true);
              }}
            />
            <button className="listSearchClose" onClick={() => { setMobileSearchOpen(false); setShowSuggestions(false); }}>
              取消
            </button>
            {showSuggestions && suggestions.length > 0 && (
              <div className="listSearchSuggestions">
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    className="tagSuggestion"
                    onMouseDown={(e) => { e.preventDefault(); }}
                    onTouchStart={() => {
                      onSelectTag(tag);
                      setShowSuggestions(false);
                      setMobileSearchOpen(false);
                    }}
                    onClick={() => {
                      onSelectTag(tag);
                      setShowSuggestions(false);
                      setMobileSearchOpen(false);
                    }}
                  >
                    <span className="tagSugIcon">#</span>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Subtitle — hidden when search is open */}
        {!mobileSearchOpen && (
          <div className="listHdrSub">
            <p>{subtitle}</p>
          </div>
        )}
        {activeTags && activeTags.size > 0 && (
          <div className="activeTags">
            {[...activeTags].map((tag) => (
              <span key={tag} className="activeTagChip">
                {tag}
                <button
                  className="chipX"
                  onClick={() => onRemoveTag(tag)}
                  aria-label={`移除话题 ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <CardGrid
        essays={essays}
        onSelectEssay={onSelectEssay}
        onTagClick={onTagClick}
        isUnlocked={isUnlocked}
        onLockedClick={onLockedClick}
      />
    </div>
  );
}
