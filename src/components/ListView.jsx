import CardGrid from './CardGrid';

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
}) {
  return (
    <div className="listView">
      <div className="listHdr">
        <h2>{title}</h2>
        <div className="listHdrSub">
          <p>{subtitle}</p>
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
      <CardGrid essays={essays} onSelectEssay={onSelectEssay} onTagClick={onTagClick} />
    </div>
  );
}
