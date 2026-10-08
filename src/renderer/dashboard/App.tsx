import { useState, useEffect } from 'preact/hooks';
import { WeekView } from './WeekView.js';
import { MonthView } from './MonthView.js';
import { SummaryView } from './SummaryView.js';
import { BriefingView } from './BriefingView.js';
import { InsightsView } from './InsightsView.js';
import { SettingsPanel } from './SettingsPanel.js';
import { SearchOverlay } from './SearchOverlay.js';
import { loadSettings, saveSettings } from './settings.js';
import type { AppSettings } from './settings.js';
import styles from './App.module.css';

type Tab = 'week' | 'summary' | 'briefing' | 'insights';
type WinsView = 'week' | 'month';

export function App() {
  const [tab, setTab] = useState<Tab>('briefing');
  const [winsView, setWinsView] = useState<WinsView>('week');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); return; }
        if (settingsOpen) return;
        window.api.closeDashboard();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen, searchOpen]);

  function handleNavigate(date: string) {
    setTab('week');
    setWinsView('week');
    // WeekView will pick up the date via its own selectedDate mechanism;
    // we use a custom event to bridge across the component boundary
    window.dispatchEvent(new CustomEvent('search:navigate', { detail: date }));
  }

  return (
    <div class={styles.overlay}>
      <div class={styles.backdrop} onMouseDown={() => window.api.closeDashboard()} />
      <div class={styles.card}>
        <div class={styles.titleBar}>
          <div class={styles.brand}>
            <div class={styles.brandDot} />
            <span class={styles.brandName}>Weekly Wins</span>
          </div>

          {tab === 'week' && (
            <div class={styles.viewSwitcher}>
              {(['week', 'month'] as WinsView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setWinsView(v)}
                  class={`${styles.viewBtn} ${winsView === v ? styles.viewBtnActive : ''}`}
                >
                  {v === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          )}

          <div class={styles.tabs} style={{ marginLeft: 'auto' }}>
            {(['briefing', 'week', 'summary', 'insights'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                class={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              >
                {t === 'briefing' ? 'Briefing' : t === 'week' ? 'Wins' : t === 'summary' ? 'Summaries' : 'Insights'}
              </button>
            ))}
          </div>

          <button
            class={styles.iconBtn}
            onClick={() => setSearchOpen(true)}
            title="Search (⌘F)"
          >
            ⌕
          </button>

          <button
            class={styles.iconBtn}
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>

        <div class={styles.divider} />

        <main class={styles.main}>
          {tab === 'week'
            ? winsView === 'week' ? <WeekView /> : <MonthView />
            : tab === 'summary' ? <SummaryView />
            : tab === 'insights' ? <InsightsView />
            : <BriefingView settings={settings} />
          }
          {settingsOpen && (
            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              onClose={() => setSettingsOpen(false)}
            />
          )}
          {searchOpen && (
            <SearchOverlay
              onClose={() => setSearchOpen(false)}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>
    </div>
  );
}
