export default function CardGrid({ essays, onSelectEssay, onTagClick }) {
  if (!essays.length) {
    return (
      <div className="listView">
        <p className="emptyState">没有找到匹配的短文</p>
      </div>
    );
  }

  return (
    <div className="grid">
      {essays.map((e, i) => (
        <div
          key={e.id}
          className="card"
          style={{ animationDelay: `${i * 0.06}s` }}
          onClick={() => onSelectEssay(e.id)}
        >
          <div className="cardImgW">
            <img className="cardImg" src={e.cover} alt={e.title} loading="lazy" />
          </div>
          <div className="cardBody">
            <div className="cardTitle">{e.title}</div>
            <div className="cardMeta">
              {e.author && <span className="cardAuthor">{e.author}</span>}
              <span className="cardDate">{e.date}</span>
              <span className="cardCat">{e.category}</span>
              <span className="cardTime">{e.time}</span>
            </div>
            <div className="cardSum">{e.summary}</div>
            <div className="cardFt">
              <div className="cardTags">
                {e.tags.map((t) => (
                  <span
                    key={t}
                    className="cardTag"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick?.(t);
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <span className="cardRead">阅读 →</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
