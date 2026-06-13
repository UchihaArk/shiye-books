import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import './styles/index.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SidebarOverlay from './components/SidebarOverlay';
import ListView from './components/ListView';
import ReadingView from './components/ReadingView';
import BackToTop from './components/BackToTop';
import SecretModal from './components/SecretModal';
import MobileSearch from './components/MobileSearch';
import { loadIndex, clearIndexCache } from './lib/api';
import { verifySecret, isUnlocked as checkUnlocked, markUnlocked } from './lib/secrets';

function isMobile() {
  return window.innerWidth <= 768;
}

/**
 * Read the initial route from the current URL.
 * - "/"         → list view
 * - "/e/:id"    → reading view with that essay
 */
function readRouteFromURL() {
  const path = decodeURIComponent(window.location.pathname);
  const match = path.match(/^\/e\/(.+)$/);
  if (match) return { view: 'reading', essayId: match[1] };
  return { view: 'list', essayId: null };
}

export default function App() {
  // Async index data
  const [indexData, setIndexData] = useState(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState(null);

  // Derived data
  const essays = indexData?.essays || {};
  const essayOrder = indexData?.essayOrder || [];
  const totalEssays = essayOrder.length;
  const latestDate = essayOrder.length ? essays[essayOrder[0]]?.date : '';

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('sy-theme') || 'oriental');

  // View state — initialise from URL so refresh preserves current page
  const initialRoute = useMemo(readRouteFromURL, []);
  const [currentView, setCurrentView] = useState(initialRoute.view);
  const [currentEssay, setCurrentEssay] = useState(initialRoute.essayId);

  // Filters
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTags, setActiveTags] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [showBackTop, setShowBackTop] = useState(false);

  // Secret unlock state
  const [unlockTarget, setUnlockTarget] = useState(null);

  // Mobile search page
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Flag: when true, navigation is triggered by popstate — skip pushState
  const popstateRef = useRef(false);

  // --- Load index on mount ---
  useEffect(() => {
    let cancelled = false;
    loadIndex()
      .then((data) => {
        if (!cancelled) {
          setIndexData(data);
          setIndexLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIndexError(err.message);
          setIndexLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sy-theme', theme);
  }, [theme]);

  // Scroll listener (list mode only)
  useEffect(() => {
    const handleScroll = () => {
      if (currentView !== 'list') return;
      const st = window.scrollY;
      setShowBackTop(st > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (unlockTarget) { setUnlockTarget(null); return; }
        if (currentView === 'reading') { showList(); closeSidebarMobile(); return; }
        setSearchQuery('');
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.querySelector('.searchBox input')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentView, unlockTarget]);

  // Listen for open-essay events from navigation buttons (always replace — prev/next)
  useEffect(() => {
    const handler = (e) => openEssay(e.detail, true);
    window.addEventListener('open-essay', handler);
    return () => window.removeEventListener('open-essay', handler);
  }, [openEssay]);

  // --- Browser history: popstate (back / forward) ---
  useEffect(() => {
    const onPopState = () => {
      const route = readRouteFromURL();
      popstateRef.current = true;
      if (route.view === 'reading' && route.essayId) {
        setCurrentView('reading');
        setCurrentEssay(route.essayId);
      } else {
        setCurrentView('list');
        setCurrentEssay(null);
      }
      requestAnimationFrame(() => { popstateRef.current = false; });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // On first mount, normalise the URL with replaceState (no extra history entry)
  useEffect(() => {
    if (currentView === 'reading' && currentEssay) {
      const hash = window.location.hash; // preserve chapter hash
      window.history.replaceState(null, '', `/e/${encodeURIComponent(currentEssay)}${hash}`);
    } else {
      window.history.replaceState(null, '', '/');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Actions ---
  const showList = useCallback(() => {
    setCurrentView('list');
    setCurrentEssay(null);
    if (!popstateRef.current) {
      // replaceState: going back to list replaces the current history entry
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const openEssay = useCallback((id, replace = false) => {
    const prevView = currentView;
    setCurrentView('reading');
    setCurrentEssay(id);
    if (isMobile()) closeSidebarMobile();
    if (!popstateRef.current) {
      const url = `/e/${encodeURIComponent(id)}`;
      // replace: article-to-article navigation (prev/next), search→article
      // push: list→article (first entry into reading)
      if (replace || prevView === 'reading') {
        window.history.replaceState(null, '', url);
      } else {
        window.history.pushState(null, '', url);
      }
    }
  }, [currentView]);

  const handleToggleSidebar = useCallback(() => {
    if (isMobile()) {
      setSidebarOpen((o) => !o);
    } else {
      setSidebarCollapsed((c) => !c);
    }
  }, []);

  const closeSidebarMobile = useCallback(() => {
    if (isMobile()) setSidebarOpen(false);
  }, []);

  const handleSwitchTheme = useCallback((t) => setTheme(t), []);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    setActiveCategory(null);
    setActiveTags(new Set());
  }, []);

  const handleToggleCategory = useCallback((cat) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
    setActiveTags(new Set());
    if (currentView === 'reading') showList();
    if (isMobile()) closeSidebarMobile();
  }, [currentView, showList]);

  const handleToggleTag = useCallback((tag) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
    setActiveCategory(null);
    if (currentView === 'reading') showList();
    if (isMobile()) closeSidebarMobile();
  }, [currentView, showList]);

  const handleSelectTag = useCallback((tag) => {
    setSearchQuery('');
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (!next.has(tag)) next.add(tag);
      return next;
    });
    setActiveCategory(null);
    if (currentView === 'reading') showList();
  }, [currentView, showList]);

  const handleRemoveTag = useCallback((tag) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.delete(tag);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setActiveCategory(null);
    setActiveTags(new Set());
    setSearchQuery('');
    if (currentView === 'reading') showList();
  }, [currentView, showList]);

  const handleRetryIndex = useCallback(() => {
    clearIndexCache();
    setIndexLoading(true);
    setIndexError(null);
    loadIndex()
      .then((data) => {
        setIndexData(data);
        setIndexLoading(false);
      })
      .catch((err) => {
        setIndexError(err.message);
        setIndexLoading(false);
      });
  }, []);

  // --- Locked essay handling ---
  const handleSelectEssay = useCallback((id) => {
    const essay = essays[id];
    if (essay?.locked && !checkUnlocked(id)) {
      setUnlockTarget(id);
      return;
    }
    openEssay(id);
  }, [essays, openEssay]);

  const handleLockedClick = useCallback((id) => {
    setUnlockTarget(id);
  }, []);

  const handleSecretVerify = useCallback(async (input) => {
    return verifySecret(unlockTarget, input);
  }, [unlockTarget]);

  const handleSecretSuccess = useCallback(() => {
    if (unlockTarget) {
      markUnlocked(unlockTarget);
      openEssay(unlockTarget);
      setUnlockTarget(null);
    }
  }, [unlockTarget, openEssay]);

  const handleSecretClose = useCallback(() => {
    setUnlockTarget(null);
  }, []);

  // --- Filtered essays ---
  const filteredEssays = useMemo(() => {
    let list = essayOrder.map((id) => essays[id]).filter(Boolean);
    if (activeCategory) list = list.filter((e) => e.category === activeCategory);
    if (activeTags.size) list = list.filter((e) => [...activeTags].some((t) => e.tags.includes(t)));
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.author?.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
    return list;
  }, [essays, essayOrder, activeCategory, activeTags, searchQuery]);

  // --- Header text ---
  const headerInfo = useMemo(() => {
    const q = searchQuery.trim();
    const hasFilter = !!(activeCategory || activeTags.size || q);
    if (q) return { title: `搜索「${q}」`, subtitle: '', showClear: hasFilter };
    if (activeTags.size) return { title: '话题', subtitle: '', showClear: hasFilter };
    if (activeCategory) return { title: activeCategory, subtitle: '', showClear: hasFilter };
    return {
      title: '全部短文',
      subtitle: `共 ${totalEssays} 篇 · 最近更新于 ${latestDate}`,
      showClear: false,
    };
  }, [activeCategory, activeTags, searchQuery, totalEssays, latestDate]);

  // --- Loading / Error states ---
  if (indexLoading) {
    return (
      <div className="appLoading">
        <div className="appLoadingSpinner" />
        <span>正在加载…</span>
      </div>
    );
  }

  if (indexError) {
    return (
      <div className="appError">
        <span>加载失败：{indexError}</span>
        <button onClick={handleRetryIndex}>重试</button>
      </div>
    );
  }

  return (
    <>
      {currentView === 'list' && <BackToTop visible={showBackTop} />}
      <SidebarOverlay show={isMobile() && sidebarOpen} onClose={closeSidebarMobile} />

      <Header
        theme={theme}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onSelectTag={handleSelectTag}
        onToggleSidebar={handleToggleSidebar}
        onReset={handleReset}
        onSwitchTheme={handleSwitchTheme}
        allTags={indexData?.allTags || []}
      />

      <div className="app">
        <Sidebar
          activeCategory={activeCategory}
          collapsed={!isMobile() && sidebarCollapsed}
          mobileOpen={isMobile() && sidebarOpen}
          onToggleCategory={handleToggleCategory}
          onToggleSidebar={handleToggleSidebar}
          essays={essays}
          categories={indexData?.categories || []}
          reading={currentView === 'reading'}
        />
        <main className="main">
          <ListView
            title={headerInfo.title}
            subtitle={headerInfo.subtitle}
            showClear={headerInfo.showClear}
            onClear={handleReset}
            essays={filteredEssays}
            onSelectEssay={handleSelectEssay}
            activeTags={activeTags}
            onRemoveTag={handleRemoveTag}
            onTagClick={handleToggleTag}
            onOpenMobileSearch={() => setMobileSearchOpen(true)}
            searchQuery={searchQuery}
            isUnlocked={checkUnlocked}
            onLockedClick={handleLockedClick}
          />
          {currentView === 'reading' && currentEssay && (
            <ReadingView
              essayId={currentEssay}
              onBack={showList}
              essays={essays}
              essayOrder={essayOrder}
              onUnlock={handleLockedClick}
            />
          )}
        </main>
      </div>

      {unlockTarget && essays[unlockTarget] && (
        <SecretModal
          title={essays[unlockTarget].title}
          onVerify={handleSecretVerify}
          onSuccess={handleSecretSuccess}
          onClose={handleSecretClose}
        />
      )}

      <MobileSearch
        open={mobileSearchOpen}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onSelectTag={handleSelectTag}
        onSelectEssay={(id) => openEssay(id, true)}
        onClose={() => setMobileSearchOpen(false)}
        allTags={indexData?.allTags || []}
        allEssays={essays}
        essayOrder={essayOrder}
      />
    </>
  );
}
