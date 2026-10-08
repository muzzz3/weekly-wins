import { useState, useEffect, useRef } from 'preact/hooks';
import type { WeatherData, NewsArticle, NewsCategory, Todo, TodoStatus } from './types.js';
import type { AppSettings } from './settings.js';
import { StatusDot } from './StatusDot.js';
import { ArticleViewer } from './ArticleViewer.js';
import styles from './BriefingView.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function focusKey(): string {
  const d = new Date();
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `daily-focus-${ds}`;
}

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

function weatherTint(code: number): string {
  if (code === 0 || code === 1) return styles.tintSunny;
  if (code <= 3) return styles.tintCloudy;
  if (code <= 48) return styles.tintFog;
  if (code <= 67) return styles.tintRain;
  if (code <= 77) return styles.tintSnow;
  if (code <= 82) return styles.tintRain;
  return styles.tintStorm;
}

// ── Today panel ──────────────────────────────────────────────────────────────

function TodayPanel() {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [focus, setFocus] = useState(() => localStorage.getItem(focusKey()) ?? '');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [noteCount, setNoteCount] = useState(0);
  const focusRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = focusRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [focus]);

  async function loadTodos() {
    const all = await window.api.listTodos();
    setTodos(all);
  }

  async function loadNotes() {
    const notes = await window.api.getNotesByDateRange(
      new Date(`${today}T00:00:00.000`).toISOString(),
      new Date(`${today}T23:59:59.999`).toISOString()
    );
    setNoteCount(notes.length);
  }

  useEffect(() => {
    loadTodos();
    loadNotes();
    const u1 = window.api.onTodosUpdated(loadTodos);
    const u2 = window.api.onNotesUpdated(loadNotes);
    return () => { u1(); u2(); };
  }, []);

  function saveFocus(val: string) {
    setFocus(val);
    localStorage.setItem(focusKey(), val);
  }

  async function cycleStatus(id: number, status: TodoStatus) {
    await window.api.updateTodoStatus(id, status);
  }

  const overdueTodos = todos.filter(
    (t) => t.assigned_date && t.assigned_date < today &&
           (t.status === 'not-started' || t.status === 'in-progress')
  );
  const todayTodos = [
    ...todos.filter((t) => t.assigned_date === today && t.status !== 'cancelled'),
    ...overdueTodos,
  ];
  const activeTodayTodos = todayTodos.filter((t) => t.status !== 'done');
  const doneTodayTodos = todayTodos.filter((t) => t.status === 'done');
  const progress = todayTodos.length > 0
    ? Math.round((doneTodayTodos.length / todayTodos.length) * 100)
    : 0;

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div class={styles.todayPanel}>
      {/* Header */}
      <div class={styles.todayHeader}>
        <div class={styles.todayGreeting}>{greeting()}</div>
        <div class={styles.todayDate}>{dateLabel}</div>
      </div>

      {/* Daily focus */}
      <div class={styles.focusBlock}>
        <div class={styles.focusLabel}>Today's focus</div>
        <textarea
          ref={focusRef}
          class={styles.focusInput}
          placeholder="What's the one thing today?"
          value={focus}
          rows={1}
          onInput={(e) => {
            const el = e.target as HTMLTextAreaElement;
            saveFocus(el.value);
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
        />
      </div>

      {/* Overdue callout */}
      {overdueTodos.length > 0 && (
        <div class={styles.overdueCallout}>
          <span class={styles.overdueIcon}>⚠</span>
          <span>{overdueTodos.length} overdue task{overdueTodos.length !== 1 ? 's' : ''} from previous days</span>
        </div>
      )}

      {/* Progress bar */}
      {todayTodos.length > 0 && (
        <div class={styles.todayProgressRow}>
          <div class={styles.todayProgressBar}>
            <div class={styles.todayProgressFill} style={{ width: `${progress}%` }} />
          </div>
          <span class={styles.todayProgressLabel}>{doneTodayTodos.length}/{todayTodos.length}</span>
        </div>
      )}

      {/* Todo list */}
      <div class={styles.todayTodos}>
        {activeTodayTodos.length === 0 && doneTodayTodos.length === 0 ? (
          <div class={styles.todayEmpty}>No todos for today yet.</div>
        ) : (
          <>
            {activeTodayTodos.map((t) => (
              <div key={t.id} class={styles.todayTodoRow}>
                <StatusDot status={t.status} size="sm" onChange={(s) => cycleStatus(t.id, s)} />
                <span class={styles.todayTodoText}>{t.text}</span>
              </div>
            ))}
            {doneTodayTodos.map((t) => (
              <div key={t.id} class={`${styles.todayTodoRow} ${styles.todayTodoDone}`}>
                <StatusDot status={t.status} size="sm" onChange={(s) => cycleStatus(t.id, s)} />
                <span class={`${styles.todayTodoText} ${styles.todayTodoTextDone}`}>{t.text}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer stats */}
      <div class={styles.todayFooter}>
        <span class={styles.todayStatChip}>
          {noteCount} note{noteCount !== 1 ? 's' : ''} today
        </span>
        {noteCount === 0 && (
          <span class={styles.todayNudge}>Nothing logged yet — open the bar to capture a win</span>
        )}
      </div>
    </div>
  );
}

// ── Weather widget ───────────────────────────────────────────────────────────

function WeatherWidget({ data }: { data: WeatherData }) {
  return (
    <div class={`${styles.weatherCard} ${weatherTint(data.conditionCode)}`}>
      <div class={styles.weatherLocation}>{data.location}</div>
      <div class={styles.weatherMain}>
        <span class={styles.weatherEmoji}>{weatherEmoji(data.conditionCode)}</span>
        <span class={styles.weatherTemp}>{data.temperature}{data.unit}</span>
      </div>
      <div class={styles.weatherCondition}>{data.condition}</div>
      <div class={styles.weatherStats}>
        <div class={styles.weatherStat}>
          <span class={styles.weatherStatLabel}>High</span>
          <span class={styles.weatherStatValue}>{data.high}°</span>
        </div>
        <div class={styles.weatherStatDivider} />
        <div class={styles.weatherStat}>
          <span class={styles.weatherStatLabel}>Low</span>
          <span class={styles.weatherStatValue}>{data.low}°</span>
        </div>
        <div class={styles.weatherStatDivider} />
        <div class={styles.weatherStat}>
          <span class={styles.weatherStatLabel}>Wind</span>
          <span class={styles.weatherStatValue}>{data.windspeed} km/h</span>
        </div>
        <div class={styles.weatherStatDivider} />
        <div class={styles.weatherStat}>
          <span class={styles.weatherStatLabel}>Rain</span>
          <span class={styles.weatherStatValue}>{data.precipitationChance}%</span>
        </div>
      </div>
    </div>
  );
}

// ── News widgets ─────────────────────────────────────────────────────────────

function TopNewsWidget({ articles, onOpen }: { articles: NewsArticle[]; onOpen: (a: NewsArticle) => void }) {
  return (
    <div class={styles.topNewsCard}>
      <div class={styles.widgetLabel}>Top Headlines</div>
      <div class={styles.topNewsList}>
        {articles.slice(0, 6).map((a, i) => (
          <button key={i} class={styles.topNewsItem} onClick={() => onOpen(a)}>
            <span class={styles.topNewsSource}>{a.source}</span>
            <span class={styles.topNewsTitle}>{a.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  top: 'Top', tech: 'Technology', world: 'World', science: 'Science',
};

function CategoryRow({ category, articles, onOpen }: { category: NewsCategory; articles: NewsArticle[]; onOpen: (a: NewsArticle) => void }) {
  if (articles.length === 0) return null;
  return (
    <div class={styles.categoryRow}>
      <div class={styles.categoryLabel}>{CATEGORY_LABELS[category]}</div>
      <div class={styles.categoryScroll}>
        {articles.map((a, i) => (
          <button key={i} class={styles.articleCard} onClick={() => onOpen(a)}>
            <span class={styles.articleSource}>{a.source}</span>
            <span class={styles.articleTitle}>{a.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

interface BriefingViewProps {
  settings: AppSettings;
}

export function BriefingView({ settings }: BriefingViewProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [news, setNews] = useState<Record<NewsCategory, NewsArticle[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const prevSettingsRef = useRef(settings);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const prev = prevSettingsRef.current;
    const locationChanged = prev.location?.city !== settings.location?.city;
    const unitChanged = prev.tempUnit !== settings.tempUnit;
    prevSettingsRef.current = settings;
    if (locationChanged || unitChanged) load();
  }, [settings.location, settings.tempUnit]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      let lat = settings.location?.lat;
      let lon = settings.location?.lon;
      if (lat === undefined || lon === undefined) {
        const coords = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => resolve(null),
            { timeout: 5000 }
          );
        });
        lat = coords?.lat;
        lon = coords?.lon;
      }
      const [w, n] = await Promise.all([
        window.api.getWeather(lat, lon, settings.tempUnit),
        window.api.getNews(),
      ]);
      setWeather(w);
      setNews(n);
    } catch {
      setError('Could not load briefing. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div class={styles.outerLayout}>
        <TodayPanel />
        <div class={styles.worldCol}>
          <div class={styles.state}>
            <div class={styles.spinner} />
            <div class={styles.stateText}>Loading briefing…</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class={styles.outerLayout}>
        <TodayPanel />
        <div class={styles.worldCol}>
          <div class={styles.state}>
            <div class={styles.stateText}>{error}</div>
            <button class={styles.retryBtn} onClick={load}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const categories = settings.newsCategories.filter((c) => c !== 'top');

  return (
    <>
      <div class={styles.outerLayout}>
        <TodayPanel />
        <div class={styles.worldCol}>
          <div class={styles.topRow}>
            {weather && <WeatherWidget data={weather} />}
            {news && settings.newsCategories.includes('top') && (
              <TopNewsWidget articles={news.top} onOpen={setActiveArticle} />
            )}
          </div>
          {news && (
            <div class={styles.categorySection}>
              {categories.map((c) => (
                <CategoryRow key={c} category={c} articles={news[c]} onOpen={setActiveArticle} />
              ))}
            </div>
          )}
        </div>
      </div>
      {activeArticle && (
        <ArticleViewer article={activeArticle} onClose={() => setActiveArticle(null)} />
      )}
    </>
  );
}
