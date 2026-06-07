import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import './styles/index.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SidebarOverlay from './components/SidebarOverlay';
import ListView from './components/ListView';
import ReadingView from './components/ReadingView';
import ProgressBar from './components/ProgressBar';
import BackToTop from './components/BackToTop';
import ImmersiveBar from './components/ImmersiveBar';
import SecretModal from './components/SecretModal';
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
  const [immersive, setImmersive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);

  // Secret unlock state
  const [unlockTarget, setUnlockTarget] = useState(null);

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

  // Apply immersive class to body
  useEffect(() => {
    document.body.classList.toggle('immersive', immersive);
    return () => document.body.classList.remove('immersive');
  }, [immersive]);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => {
      const st = window.scrollY;
      const dh = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(dh > 0 ? Math.min((st / dh) * 100, 100) : 0);
      setShowBackTop(st > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (unlockTarget) { setUnlockTarget(null); return; }
        if (immersive) { setImmersive(false); return; }
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
  }, [immersive, currentView, unlockTarget]);

  // Listen for open-essay events from navigation buttons
  useEffect(() => {
    const handler = (e) => openEssay(e.detail);
    window.addEventListener('open-essay', handler);
    return () => window.removeEventListener('open-essay', handler);
  }, []);

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
        setProgress(0);
      }
      if (immersive) setImmersive(false);
      requestAnimationFrame(() => { popstateRef.current = false; });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [immersive]);

  // On first mount, normalise the URL with replaceState (no extra history entry)
  useEffect(() => {
    if (currentView === 'reading' && currentEssay) {
      window.history.replaceState(null, '', `/e/${encodeURIComponent(currentEssay)}`);
    } else {
      window.history.replaceState(null, '', '/');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Actions ---
  const showList = useCallback(() => {
    setCurrentView('list');
    setCurrentEssay(null);
    setProgress(0);
    if (immersive) setImmersive(false);
    if (!popstateRef.current) {
      window.history.pushState(null, '', '/');
    }
  }, [immersive]);

  const openEssay = useCallback((id) => {
    setCurrentView('reading');
    setCurrentEssay(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (isMobile()) closeSidebarMobile();
    if (!popstateRef.current) {
      window.history.pushState(null, '', `/e/${encodeURIComponent(id)}`);
    }
  }, []);

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
    if (immersive) setImmersive(false);
  }, [currentView, immersive, showList]);

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
      {currentView === 'reading' && <ProgressBar progress={progress} />}
      <BackToTop visible={showBackTop} />
      <SidebarOverlay show={isMobile() && sidebarOpen} onClose={closeSidebarMobile} />
      <ImmersiveBar onExit={() => setImmersive(false)} />

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
          {currentView === 'list' && (
            <div className="announcement">
              <span className="announcementIcon">💡</span>
              <span className="announcementText">
                锁定内容为作者个人私密文章，仅作隐私保护，本平台不设任何付费门槛。
              </span>
            </div>
          )}
          {currentView === 'list' ? (
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
              isUnlocked={checkUnlocked}
              onLockedClick={handleLockedClick}
            />
          ) : (
            <ReadingView
              essayId={currentEssay}
              onBack={showList}
              onToggleImmersive={() => setImmersive((m) => !m)}
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
    </>
  );
}
