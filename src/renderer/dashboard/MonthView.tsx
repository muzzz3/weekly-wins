import { useState, useEffect } from 'preact/hooks';
import type { Note, DaySummary } from './types.js';
import styles from './MonthView.module.css';
import weekStyles from './WeekView.module.css';

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function getMonthDates(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null); // padding
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(isoDate(new Date(year, month, d)));
  }
  return cells;
}

function scoreCardClass(score: number): string {
  if (score >= 8) return weekStyles.cardScoreHigh;
  if (score >= 6) return weekStyles.cardScoreMedHigh;
  if (score >= 2) return weekStyles.cardScoreMedLow;
  return weekStyles.cardScoreLow;
}

function isToday(dateStr: string) {
  return dateStr === isoDate(new Date());
}

interface DayDetailProps {
  date: string;
  notes: Note[];
  summary: DaySummary | null;
  onClose: () => void;
}

function DayDetail({ date, notes, summary, onClose }: DayDetailProps) {
  const d = new Date(date + 'T12:00:00');
  const dayName = d.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
  const dateLabel = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class={weekStyles.detail}>
      <div class={weekStyles.detailHeader}>
        <button class={weekStyles.backBtn} onClick={onClose}>←</button>
        <div>
          <div class={weekStyles.detailDayName}>{dayName}</div>
          <div class={weekStyles.detailDate}>{dateLabel}</div>
        </div>
        {summary && (
          <div class={weekStyles.detailScoreBadge}>
            <div class={weekStyles.detailScoreValue}>{summary.score.toFixed(1)}</div>
            <div class={weekStyles.detailScoreLabel}>Score</div>
          </div>
        )}
      </div>
      {summary && <div class={weekStyles.aiSummary}>{summary.summary}</div>}
      <div class={weekStyles.notesList}>
        <div class={weekStyles.notesLabel}>Notes</div>
        {notes.length === 0 ? (
          <div class={weekStyles.emptyNotes}>No notes for this day.</div>
        ) : notes.map((note) => (
          <div key={note.id} class={weekStyles.noteItem}>
            <span class={weekStyles.noteTime}>{formatTime(note.created_at)}</span>
            <span class={weekStyles.noteText}>{note.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [notesByDate, setNotesByDate] = useState<Record<string, Note[]>>({});
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const cells = getMonthDates(year, month);
  const dateCells = cells.filter(Boolean) as string[];

  async function load() {
    if (dateCells.length === 0) return;
    const from = dateCells[0];
    const to = dateCells[dateCells.length - 1];
    const [notes, daySummaries] = await Promise.all([
      window.api.getNotesByDateRange(
        new Date(`${from}T00:00:00.000`).toISOString(),
        new Date(`${to}T23:59:59.999`).toISOString(),
      ),
      window.api.getSummaryRange(from, to),
    ]);
    const grouped: Record<string, Note[]> = {};
    dateCells.forEach((d) => { grouped[d] = []; });
    notes.forEach((n) => {
      const d = isoDate(new Date(n.created_at));
      if (grouped[d]) grouped[d].push(n);
    });
    setNotesByDate(grouped);
    const summaryMap: Record<string, DaySummary> = {};
    daySummaries.forEach((s) => { summaryMap[s.date] = s; });
    setSummaries(summaryMap);
  }

  useEffect(() => { load(); }, [year, month]);

  useEffect(() => {
    const u1 = window.api.onNotesUpdated(load);
    const u2 = window.api.onSummariesUpdated(load);
    return () => { u1(); u2(); };
  }, []);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  if (selectedDate) {
    return (
      <DayDetail
        date={selectedDate}
        notes={notesByDate[selectedDate] ?? []}
        summary={summaries[selectedDate] ?? null}
        onClose={() => setSelectedDate(null)}
      />
    );
  }

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <button class={styles.navBtn} onClick={prevMonth}>‹</button>
        <span class={styles.monthLabel}>{monthLabel}</span>
        <button class={styles.navBtn} onClick={nextMonth}>›</button>
      </div>

      <div class={styles.weekdays}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} class={styles.weekday}>{d}</div>
        ))}
      </div>

      <div class={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} class={styles.emptyCell} />;
          const today = isToday(date);
          const summary = summaries[date] ?? null;
          const notes = notesByDate[date] ?? [];
          const empty = notes.length === 0;
          const d = new Date(date + 'T12:00:00').getDate();

          const cardClass = [
            styles.dayCell,
            today ? styles.dayCellToday : '',
            empty ? styles.dayCellEmpty : '',
            summary ? scoreCardClass(summary.score) : '',
          ].filter(Boolean).join(' ');

          return (
            <button key={date} class={cardClass} onClick={() => setSelectedDate(date)}>
              <div class={`${styles.dayNum} ${today ? styles.dayNumToday : ''}`}>{d}</div>
              {summary && <div class={styles.score}>{summary.score.toFixed(0)}</div>}
              {!empty && !summary && <div class={styles.dot} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
