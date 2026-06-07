import { useEffect, useState, useCallback } from 'react';

export default function TOC({ contentRef, essayId }) {
  const [headings, setHeadings] = useState([]);

  useEffect(() => {
    setHeadings([]);
    const raf = requestAnimationFrame(() => {
      if (!contentRef.current) return;
      const hs = contentRef.current.querySelectorAll('h2[id], h3[id]');
      const items = [...hs].map((h) => ({
        id: h.id,
        text: h.textContent,
        level: h.tagName,
      }));
      setHeadings(items);
    });
    return () => cancelAnimationFrame(raf);
  }, [contentRef, essayId]);

  const handleClick = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  if (!headings.length) return null;

  return (
    <div className="toc">
      <h4>本章目录</h4>
      <div>
        {headings.map((h) => (
          <a
            key={h.id}
            className="tocLnk"
            style={
              h.level === 'H3'
                ? { paddingLeft: 20, fontSize: '0.65rem' }
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              handleClick(h.id);
            }}
          >
            {h.text}
          </a>
        ))}
      </div>
    </div>
  );
}
