import { useState, useEffect } from 'preact/hooks';
import type { DaySummary, Note, Todo } from './types.js';
import styles from './InsightsView.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#f59e0b';
  return '#ef4444';
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Score trend chart (pure SVG, 8 weeks) ───────────────────────────────────

function ScoreChart({ summaries }: { summaries: DaySummary[] }) {
  const [hovered, setHovered] = useState<DaySummary | null>(null);

  if (summaries.length === 0) {
    return <div class={styles.chartEmpty}>No scored days yet — notes get scored automatically after you log them.</div>;
  }

  const W = 600;
  const H = 140;
  const PAD = { top: 16, right: 16, bottom: 12, left: 12 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const sorted = [...summaries].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  function xOf(i: number) { return PAD.left + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW); }
  function yOf(score: number) { return PAD.top + chartH - (score / 10) * chartH; }

  const points = sorted.map((s, i) => `${xOf(i)},${yOf(s.score)}`).join(' ');

  return (
    <div class={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} class={styles.chartSvg}>
        {/* Grid lines */}
        {[0, 5, 10].map((v) => (
          <line key={v}
            x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)}
            stroke="rgba(230,237,243,0.07)" strokeWidth="1"
          />
        ))}

        {/* Line */}
        <polyline points={points} fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots */}
        {sorted.map((s, i) => (
          <circle
            key={s.date}
            cx={xOf(i)} cy={yOf(s.score)} r={hovered?.date === s.date ? 6 : 4}
            fill={scoreColor(s.score)}
            stroke="#161b22" strokeWidth="2"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {/* Date labels as HTML — reliable rendering, no SVG clipping */}
      <div class={styles.chartXLabels}>
        <span>{formatShortDate(sorted[0].date)}</span>
        {n > 1 && <span>{formatShortDate(sorted[n - 1].date)}</span>}
      </div>

      {hovered && (
        <div class={styles.chartTooltip}>
          <span class={styles.tooltipDate}>{formatShortDate(hovered.date)}</span>
          <span class={styles.tooltipScore} style={{ color: scoreColor(hovered.score) }}>
            {hovered.score.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Streak calculation ────────────────────────────────────────────────────────

function computeStreak(noteDates: Set<string>): { current: number; best: number } {
  const today = isoDate(new Date());
  let current = 0;
  let d = new Date();
  // Walk backwards from today
  while (true) {
    const ds = isoDate(d);
    if (!noteDates.has(ds)) break;
    current++;
    d.setDate(d.getDate() - 1);
  }
  // Best streak — scan all dates
  const sorted = [...noteDates].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const ds of sorted) {
    if (prev) {
      const diff = Math.round((new Date(ds).getTime() - new Date(prev).getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = ds;
  }
  return { current, best };
}

function mostProductiveDay(notes: Note[]): string | null {
  const counts: Record<number, number> = {};
  notes.forEach((n) => {
    const dow = new Date(n.created_at).getDay();
    counts[dow] = (counts[dow] ?? 0) + 1;
  });
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  const best = entries.reduce((a, b) => (Number(b[1]) > Number(a[1]) ? b : a));
  return DAY_NAMES[Number(best[0])];
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div class={styles.statCard}>
      <div class={styles.statValue}>{value}</div>
      <div class={styles.statLabel}>{label}</div>
      {sub && <div class={styles.statSub}>{sub}</div>}
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

const REFLECTION_PROMPTS = [
  'What made this week hard?',
  'What are you most proud of this month?',
  'What would you do differently next week?',
  'What unblocked you this week?',
  'What habit is helping you the most right now?',
];

export function InsightsView() {
  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const prompt = REFLECTION_PROMPTS[new Date().getDay() % REFLECTION_PROMPTS.length];

  useEffect(() => {
    async function load() {
      setLoading(true);
      const to = isoDate(new Date());
      const from8w = new Date(); from8w.setDate(from8w.getDate() - 56);
      const [sums, ns, ts] = await Promise.all([
        window.api.getSummaryRange(isoDate(from8w), to),
        window.api.listNotes(2000, 0),
        window.api.listTodos(),
      ]);
      setSummaries(sums);
      setNotes(ns);
      setTodos(ts);
      setLoading(false);
    }
    load();
    const u1 = window.api.onNotesUpdated(load);
    const u2 = window.api.onSummariesUpdated(load);
    return () => { u1(); u2(); };
  }, []);

  if (loading) {
    return (
      <div class={styles.loading}>
        <div class={styles.spinner} />
      </div>
    );
  }

  const noteDates = new Set(notes.map((n) => isoDate(new Date(n.created_at))));
  const { current: currentStreak, best: bestStreak } = computeStreak(noteDates);

  const avgScore = summaries.length > 0
    ? (summaries.reduce((s, d) => s + d.score, 0) / summaries.length).toFixed(1)
    : '—';

  const today = isoDate(new Date());
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const notesThisWeek = notes.filter((n) => isoDate(new Date(n.created_at)) >= isoDate(weekStart)).length;
  const todosCompletedThisWeek = todos.filter(
    (t) => t.status === 'done' && t.assigned_date && t.assigned_date >= isoDate(weekStart)
  ).length;

  const productiveDay = mostProductiveDay(notes);

  return (
    <div class={styles.container}>
      {/* Stat cards */}
      <div class={styles.statsRow}>
        <StatCard label="Current streak" value={currentStreak} sub={currentStreak === bestStreak && currentStreak > 0 ? '🔥 Personal best' : `Best: ${bestStreak}d`} />
        <StatCard label="Avg score (8w)" value={avgScore} sub="/10" />
        <StatCard label="Notes this week" value={notesThisWeek} />
        <StatCard label="Todos done this week" value={todosCompletedThisWeek} />
        {productiveDay && <StatCard label="Most productive day" value={productiveDay} />}
      </div>

      {/* Score trend */}
      <div class={styles.section}>
        <div class={styles.sectionLabel}>Score trend — last 8 weeks</div>
        <div class={styles.chartCard}>
          <ScoreChart summaries={summaries} />
        </div>
      </div>

      {/* Reflection prompt */}
      <div class={styles.reflectionCard}>
        <div class={styles.reflectionLabel}>Reflection</div>
        <div class={styles.reflectionPrompt}>"{prompt}"</div>
      </div>
    </div>
  );
}
