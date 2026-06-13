/** Highlight occurrences of `query` inside `text` with <mark> tags. */
function HighlightText({ text, query }) {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.filter(Boolean).map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="searchHL">{part}</mark>
      : part
  );
}

export default function CardGrid({ essays, onSelectEssay, onTagClick, isUnlocked, onLockedClick, searchQuery }) {
  if (!essays.length) {
    return (
      <div className="listView">
        <p className="emptyState">没有找到匹配的短文</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {essays.map((e, i) => {
        const locked = e.locked && !isUnlocked?.(e.id);
        return (
          <div
            key={e.id}
            className={`card${locked ? ' cardLocked' : ''}`}
            style={{ animationDelay: `${i * 0.06}s` }}
            onClick={() => {
              if (locked) {
                onLockedClick?.(e.id);
              } else {
                onSelectEssay(e.id);
              }
            }}
          >
            <div className="cardImgW">
              <img className="cardImg" src={e.cover} alt={e.title} loading="lazy" />
            </div>
            <div className="cardBody">
              <div className="cardTitle">
                <HighlightText text={e.title} query={searchQuery} />
              </div>
              <div className="cardMeta">
                {e.author && <span className="cardAuthor">{e.author}</span>}
                <span className="cardDate">{e.date}</span>
                <span className="cardCat">{e.category}</span>
                <span className="cardTime">{e.time}</span>
              </div>
              <div className="cardSum">
                <HighlightText text={e.summary} query={searchQuery} />
              </div>
              <div className="cardFt">
                <div className="cardTags">
                  {e.tags.map((t) => (
                    <span
                      key={t}
                      className={`cardTag${searchQuery && t.toLowerCase().includes(searchQuery.toLowerCase()) ? ' cardTagHL' : ''}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onTagClick?.(t);
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span className="cardRead">{locked ? '解锁阅读' : '阅读 →'}</span>
              </div>
            </div>
            {locked && (
              <div className="cardLockOverlay">
                <span className="cardLockIcon">🔒</span>
                <span className="cardLockText">输入暗号解锁</span>
                <span className="cardLockNote">仅为作者私密文章，平台不设付费门槛</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
