import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import type { Note, DaySummary, Todo, TodoStatus } from './types.js';
import { StatusDot } from './StatusDot.js';
import { TodoPanel } from './TodoPanel.js';
import { dragState } from './dragState.js';
import styles from './WeekView.module.css';

type DisplayTodo = Todo & { carried?: boolean; daysOverdue?: number };


function formatTime(isoString: string): string {
  const d = new Date(isoString);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function getWeekDates(offset = 0): string[] {
  const today = new Date();
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i + offset * 7);
    return localDate(d);
  });
}

function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function getOffsetForDate(date: string): number {
  const today = new Date();
  const target = new Date(date + 'T12:00:00');
  const todayWeekStart = new Date(today);
  todayWeekStart.setDate(today.getDate() - today.getDay());
  const targetWeekStart = new Date(target);
  targetWeekStart.setDate(target.getDate() - target.getDay());
  return Math.round((targetWeekStart.getTime() - todayWeekStart.getTime()) / (7 * 86400000));
}

function scoreCardClass(score: number): string {
  if (score >= 8) return styles.cardScoreHigh;
  if (score >= 6) return styles.cardScoreMedHigh;
  if (score >= 2) return styles.cardScoreMedLow;
  return styles.cardScoreLow;
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    name: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
    num: d.getDate(),
  };
}

function isToday(dateStr: string) {
  return dateStr === localDate();
}

interface DayCardProps {
  date: string;
  notes: Note[];
  todos: DisplayTodo[];
  summary: DaySummary | null;
  onClick: () => void;
  onTodoStatusChange: (id: number, status: TodoStatus) => void;
}

function DayCard({ date, notes, todos, summary, onClick, onTodoStatusChange }: DayCardProps) {
  const { name, num } = formatDay(date);
  const today = isToday(date);
  const empty = notes.length === 0;
  const [dragOver, setDragOver] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Use native DOM events — Preact's synthetic drag events are unreliable
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    function onDragOver(e: DragEvent) {
      e.preventDefault();
      setDragOver(true);
      console.log('[drag] dragOver (native):', date);
    }
    function onDragLeave() { setDragOver(false); }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      setDragOver(false);
      const id = dragState.todoId;
      console.log('[drag] drop (native) — date:', date, 'dragState.todoId:', id);
      if (id !== null) {
        console.log('[drag] calling assignTodo', id, date);
        window.api.assignTodo(id, date);
      } else {
        console.warn('[drag] drop fired but dragState.todoId is null');
      }
    }

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [date]);

  const cardClass = [
    styles.card,
    today ? styles.cardToday : '',
    empty && todos.length === 0 ? styles.cardEmpty : '',
    summary ? scoreCardClass(summary.score) : '',
    dragOver ? styles.cardDragOver : '',
  ].filter(Boolean).join(' ');

  const visibleTodos = todos.slice(0, 5);
  const overflow = todos.length - visibleTodos.length;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      class={cardClass}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div class={styles.cardHeader}>
        <div class={`${styles.dayName} ${today ? styles.dayNameToday : ''}`}>{name}</div>
        <div class={`${styles.dayNum} ${today ? styles.dayNumToday : ''}`}>{num}</div>
        {summary && (
          <div class={styles.scoreBlock}>
            <div class={styles.scoreValue}>{summary.score.toFixed(0)}</div>
            <div class={styles.scoreDenom}>/10</div>
          </div>
        )}
      </div>

      {empty ? (
        <div class={styles.emptyLabel}>No entries</div>
      ) : (
        <>
          <div class={styles.noteCount}>{notes.length} NOTE{notes.length !== 1 ? 'S' : ''}</div>
          {summary && <div class={styles.cardSummary}>{summary.summary}</div>}
        </>
      )}

      {todos.length > 0 && (
        <div class={styles.todoSection} onClick={(e) => e.stopPropagation()}>
          <div class={styles.todoSectionLabel}>TODOS</div>
          {visibleTodos.map((t) => (
            <div key={t.id} class={styles.todoRow}>
              <StatusDot
                status={t.status}
                size="sm"
                onChange={(s) => onTodoStatusChange(t.id, s)}
              />
              <span class={`${styles.todoRowText} ${t.status === 'done' || t.status === 'cancelled' ? styles.todoRowMuted : ''}`}>
                {t.text}
              </span>
              {t.carried && (
                <span class={`${styles.carriedChip} ${overdueChipClass(t.daysOverdue ?? 1)}`}>
                  {formatDay(t.assigned_date!).name.slice(0, 3)}
                </span>
              )}
            </div>
          ))}
          {overflow > 0 && <span class={styles.todoOverflow}>+{overflow} more</span>}
        </div>
      )}
    </div>
  );
}

interface DayDetailProps {
  date: string;
  notes: Note[];
  todos: DisplayTodo[];
  summary: DaySummary | null;
  onClose: () => void;
}

function DayDetail({ date, notes, todos, summary, onClose }: DayDetailProps) {
  const d = new Date(date + 'T12:00:00');
  const dayName = d.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
  const dateLabel = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const today = isToday(date);

  const [regenerating, setRegenerating] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [todoDraft, setTodoDraft] = useState('');
  const todoInputRef = useRef<HTMLInputElement>(null);
  const [roadblockOpenId, setRoadblockOpenId] = useState<number | null>(null);
  const [roadblockDraft, setRoadblockDraft] = useState('');
  const [completionOpenId, setCompletionOpenId] = useState<number | null>(null);

  // Group todos
  const statusRank = (s: TodoStatus) => (s === 'in-progress' ? 0 : s === 'paused' ? 1 : 2);
  const activeTodos = useMemo(() => todos
    .filter((t) => t.status === 'in-progress' || t.status === 'paused' || t.status === 'not-started')
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || (a.sort_order ?? a.id) - (b.sort_order ?? b.id)), [todos]);
  const completedTodos = todos.filter((t) => t.status === 'done' || t.status === 'cancelled');

  // Progress
  const totalCountable = todos.filter((t) => t.status !== 'cancelled').length;
  const doneCount = todos.filter((t) => t.status === 'done').length;
  const progress = totalCountable > 0 ? Math.round((doneCount / totalCountable) * 100) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function addTodo() {
    const text = todoDraft.trim();
    if (!text) return;
    const todo = await window.api.createTodo(text);
    await window.api.assignTodo(todo.id, date);
    setTodoDraft('');
    todoInputRef.current?.focus();
  }

  async function handleTodoStatus(id: number, status: TodoStatus) {
    await window.api.updateTodoStatus(id, status);
  }

  async function submitRoadblock(todoId: number) {
    const text = roadblockDraft.trim();
    if (!text) { setRoadblockOpenId(null); return; }
    await window.api.addRoadblockNote(todoId, text);
    setRoadblockDraft('');
    setRoadblockOpenId(null);
  }

  const reorderActive = useCallback(async (draggedId: number, targetId: number) => {
    if (draggedId === targetId) return;
    const ids = activeTodos.map((t) => t.id);
    const fromIdx = ids.indexOf(draggedId);
    if (fromIdx === -1) return;
    ids.splice(fromIdx, 1);
    const toIdx = ids.indexOf(targetId);
    if (toIdx === -1) return;
    ids.splice(toIdx, 0, draggedId);
    await window.api.reorderTodos(ids);
  }, [activeTodos]);

  async function regenerate() {
    setRegenerating(true);
    await window.api.regenerateDaySummary(date);
    setRegenerating(false);
  }

  return (
    <div class={styles.detail}>
      {/* ── Top section ── */}
      <div class={styles.detailTop}>
        <div class={styles.detailHeader}>
          <button class={styles.backBtn} onClick={onClose}>←</button>
          <div class={styles.detailTitleGroup}>
            <div class={styles.detailDayName}>
              {dayName}
              {today && <span class={styles.todayBadge}>Today</span>}
            </div>
            <div class={styles.detailDate}>{dateLabel}</div>
          </div>
          {summary && (
            <div class={styles.detailScoreBadge}>
              <div class={styles.detailScoreValue}>{summary.score.toFixed(1)}</div>
              <div class={styles.detailScoreLabel}>Score</div>
            </div>
          )}
        </div>

        {todos.length > 0 && (
          <div class={styles.progressBlock}>
            <div class={styles.progressBar}>
              <div class={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span class={styles.progressLabel}>{doneCount} of {totalCountable} done</span>
          </div>
        )}

        {summary && (
          <div class={styles.aiSummaryBlock}>
            <button class={styles.aiSummaryToggle} onClick={() => setSummaryOpen(!summaryOpen)}>
              <span class={styles.notesLabel}>AI Summary</span>
              <div class={styles.aiSummaryActions}>
                <button
                  class={styles.regenerateBtn}
                  onClick={(e) => { e.stopPropagation(); regenerate(); }}
                  disabled={regenerating}
                >
                  {regenerating ? '…' : '↻ Regenerate'}
                </button>
                <span class={styles.summaryChevron}>{summaryOpen ? '▾' : '▸'}</span>
              </div>
            </button>
            {summaryOpen && <div class={styles.aiSummary}>{summary.summary}</div>}
          </div>
        )}
      </div>

      {/* ── Two-column body ── */}
      <div class={styles.detailBody}>

        {/* Todos column */}
        <div class={styles.todosCol}>
          <div class={styles.colLabel}>Todos</div>

          <div class={styles.todoAddRow}>
            <input
              ref={todoInputRef}
              class={styles.todoAddInput}
              placeholder="Add a todo…"
              value={todoDraft}
              onInput={(e) => setTodoDraft((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            />
          </div>

          {activeTodos.length === 0 && completedTodos.length === 0 && (
            <div class={styles.emptyCol}>No todos yet.</div>
          )}

          {activeTodos.map((todo) => (
            <ActiveTodoRow
              key={todo.id}
              todo={todo}
              onStatusChange={handleTodoStatus}
              onUnassign={(id) => window.api.assignTodo(id, null)}
              roadblockOpenId={roadblockOpenId}
              roadblockDraft={roadblockDraft}
              onToggleRoadblock={(id) => { setRoadblockOpenId(roadblockOpenId === id ? null : id); setRoadblockDraft(''); }}
              onRoadblockDraftChange={setRoadblockDraft}
              onSubmitRoadblock={submitRoadblock}
              onCancelRoadblock={() => setRoadblockOpenId(null)}
              onReorder={reorderActive}
            />
          ))}

          {completedTodos.length > 0 && (
            <div class={styles.completedSection}>
              <button class={styles.completedToggle} onClick={() => setCompletedOpen(!completedOpen)}>
                <span>{completedOpen ? '▾' : '▸'}</span>
                <span>{completedTodos.length} completed</span>
              </button>
              {completedOpen && completedTodos.map((todo) => (
                <div key={todo.id}>
                  <div class={`${styles.todoDetailRow} ${styles.todoDetailRowDone}`}>
                    <StatusDot status={todo.status} size="md" onChange={(s) => handleTodoStatus(todo.id, s)} />
                    <span class={`${styles.todoDetailText} ${styles.todoDetailTextDone}`}>{todo.text}</span>
                    {todo.carried && todo.assigned_date && (
                      <span class={styles.carriedChipMd}>
                        from {formatDay(todo.assigned_date).name}
                      </span>
                    )}
                    <button class={styles.unassignBtn} onClick={() => window.api.assignTodo(todo.id, null)} title="Remove from day">↩</button>
                  </div>
                  {todo.status === 'done' && todo.completed_at && (
                    todo.started_at ? (
                      <div class={styles.aiSummaryBlock}>
                        <button class={styles.aiSummaryToggle} onClick={() => setCompletionOpenId(completionOpenId === todo.id ? null : todo.id)}>
                          <span class={styles.notesLabel}>
                            {formatTime(todo.started_at)} → {formatTime(todo.completed_at)}
                            {todo.elapsed_ms != null && ` · took ${formatElapsed(todo.elapsed_ms)}`}
                          </span>
                          <span class={styles.summaryChevron}>{completionOpenId === todo.id ? '▾' : '▸'}</span>
                        </button>
                        {completionOpenId === todo.id && (
                          <div class={styles.aiSummary}>
                            {todo.completion_summary ?? 'Generating summary…'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div class={styles.todoDetailText}>Completed {formatTime(todo.completed_at)}</div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes column */}
        <div class={styles.notesCol}>
          <div class={styles.colLabel}>Notes</div>
          {notes.length === 0 ? (
            <div class={styles.emptyCol}>No notes for this day.</div>
          ) : notes.map((note) => (
            <NoteRow key={note.id} note={note} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ActiveTodoRowProps {
  todo: DisplayTodo;
  onStatusChange: (id: number, status: TodoStatus) => void;
  onUnassign: (id: number) => void;
  roadblockOpenId: number | null;
  roadblockDraft: string;
  onToggleRoadblock: (id: number) => void;
  onRoadblockDraftChange: (value: string) => void;
  onSubmitRoadblock: (id: number) => void;
  onCancelRoadblock: () => void;
  onReorder: (draggedId: number, targetId: number) => void;
}

function ActiveTodoRow({
  todo, onStatusChange, onUnassign, roadblockOpenId, roadblockDraft,
  onToggleRoadblock, onRoadblockDraftChange, onSubmitRoadblock, onCancelRoadblock, onReorder,
}: ActiveTodoRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Native drag listeners — more reliable than Preact synthetic events (see TodoPanel.tsx)
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    function onDragStart(e: DragEvent) {
      console.log('[reorder] dragStart — todoId:', todo.id);
      dragState.todoId = todo.id;
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', String(todo.id));
    }
    function onDragEnd() {
      console.log('[reorder] dragEnd');
      dragState.todoId = null;
      setDragOver(false);
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      if (dragState.todoId !== null && dragState.todoId !== todo.id) setDragOver(true);
    }
    function onDragLeave() { setDragOver(false); }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      console.log('[reorder] drop — dragState.todoId:', dragState.todoId, 'target todo.id:', todo.id);
      setDragOver(false);
      const draggedId = dragState.todoId;
      if (draggedId !== null && draggedId !== todo.id) onReorder(draggedId, todo.id);
    }
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('dragend', onDragEnd);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [todo.id, onReorder]);

  return (
    <div>
      <div
        ref={rowRef}
        draggable
        class={`${styles.todoDetailRow} ${styles.todoDetailRowDraggable} ${dragOver ? styles.todoDetailRowDragOver : ''} ${todo.carried ? overdueRowClass(todo.daysOverdue ?? 1) : ''}`}
      >
        <StatusDot status={todo.status} size="md" onChange={(s) => onStatusChange(todo.id, s)} />
        <span class={styles.todoDetailText}>{todo.text}</span>
        {todo.carried && todo.assigned_date && (
          <span class={`${styles.carriedChipMd} ${overdueChipClass(todo.daysOverdue ?? 1)}`}>
            from {formatDay(todo.assigned_date).name}
          </span>
        )}
        {(todo.status === 'in-progress' || todo.status === 'paused') && (
          <button
            class={`${styles.roadblockBtn} ${roadblockOpenId === todo.id ? styles.roadblockBtnActive : ''}`}
            onClick={() => onToggleRoadblock(todo.id)}
            title="Add a note to this todo"
          >
            ⚑
          </button>
        )}
        <button class={styles.unassignBtn} onClick={() => onUnassign(todo.id)} title="Remove from day">↩</button>
      </div>
      {roadblockOpenId === todo.id && (
        <div class={styles.todoAddRow}>
          <input
            autoFocus
            class={styles.todoAddInput}
            placeholder="What's blocking this?"
            value={roadblockDraft}
            onInput={(e) => onRoadblockDraftChange((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitRoadblock(todo.id);
              if (e.key === 'Escape') onCancelRoadblock();
            }}
          />
        </div>
      )}
    </div>
  );
}

const PRESET_TAGS = ['Work', 'Win', 'Blocker', 'Learning', 'Personal'];

function NoteRow({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [draftTags, setDraftTags] = useState<string[]>(note.tags);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  function startEdit() {
    setDraft(note.text);
    setDraftTags(note.tags);
    setEditing(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) { cancel(); return; }
    setSaving(true);
    await window.api.editNote(note.id, trimmed, draftTags);
    setSaving(false);
    setEditing(false);
  }

  async function remove() {
    await window.api.deleteNote(note.id);
  }

  function cancel() {
    setDraft(note.text);
    setDraftTags(note.tags);
    setEditing(false);
  }

  function toggleTag(tag: string) {
    setDraftTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  if (editing) {
    return (
      <div class={styles.noteItem}>
        <span class={styles.noteTime}>{formatTime(note.created_at)}</span>
        <div class={styles.noteEditArea}>
          <textarea
            ref={inputRef}
            class={styles.noteEditInput}
            value={draft}
            onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
              if (e.key === 'Escape') cancel();
            }}
            rows={2}
          />
          <div class={styles.noteEditTags}>
            {PRESET_TAGS.map((tag) => (
              <button
                key={tag}
                class={`${styles.noteEditTag} ${draftTags.includes(tag) ? styles.noteEditTagActive : ''}`}
                onClick={() => toggleTag(tag)}
                tabIndex={-1}
              >
                {tag}
              </button>
            ))}
          </div>
          <div class={styles.noteEditActions}>
            <button class={styles.noteActionSave} onClick={save} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
            <button class={styles.noteActionCancel} onClick={cancel}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class={styles.noteItem}>
      <span class={styles.noteTime}>{formatTime(note.created_at)}</span>
      <div class={styles.noteBody}>
        <span class={styles.noteText}>{note.text}</span>
        {note.tags.length > 0 && (
          <div class={styles.noteTags}>
            {note.tags.map((tag) => (
              <span key={tag} class={styles.noteTag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div class={styles.noteActions}>
        <button class={styles.noteActionBtn} onClick={startEdit} title="Edit">✎</button>
        <button class={styles.noteActionBtn} onClick={remove} title="Delete">✕</button>
      </div>
    </div>
  );
}

function overdueChipClass(days: number): string {
  if (days >= 3) return styles.carriedChipRed;
  if (days >= 2) return styles.carriedChipOrange;
  return '';
}

function overdueRowClass(days: number): string {
  if (days >= 3) return styles.overdueRowRed;
  if (days >= 2) return styles.overdueRowOrange;
  return '';
}

export function WeekView() {
  const [notesByDate, setNotesByDate] = useState<Record<string, Note[]>>({});
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [todosByDate, setTodosByDate] = useState<Record<string, DisplayTodo[]>>({});
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const weekDates = getWeekDates(weekOffset);
  const today = localDate();
  const isCurrentWeek = weekOffset === 0;

  async function load() {
    // Convert local day boundaries to UTC via local-time Date parsing (no "Z" suffix),
    // since created_at is stored in UTC but weekDates are local calendar days.
    const from = new Date(weekDates[0] + 'T00:00:00.000').toISOString();
    const to = new Date(weekDates[6] + 'T23:59:59.999').toISOString();
    const [notes, daySummaries, todos] = await Promise.all([
      window.api.getNotesByDateRange(from, to),
      window.api.getSummaryRange(weekDates[0], weekDates[6]),
      window.api.listTodos(),
    ]);

    const grouped: Record<string, Note[]> = {};
    weekDates.forEach((d) => { grouped[d] = []; });
    notes.forEach((n) => {
      const d = localDate(new Date(n.created_at));
      if (grouped[d]) grouped[d].push(n);
    });
    setNotesByDate(grouped);

    const summaryMap: Record<string, DaySummary> = {};
    daySummaries.forEach((s) => { summaryMap[s.date] = s; });
    setSummaries(summaryMap);

    const byDate: Record<string, DisplayTodo[]> = {};
    weekDates.forEach((d) => { byDate[d] = []; });
    todos.forEach((t) => {
      if (t.assigned_date && byDate[t.assigned_date]) byDate[t.assigned_date].push(t);
    });

    // Carry forward unfinished todos from past days into today (current week only)
    if (isCurrentWeek) {
      const carried = todos.filter(
        (t) => t.assigned_date && t.assigned_date < today &&
               (t.status === 'not-started' || t.status === 'in-progress')
      );
      const todayIds = new Set(byDate[today]?.map((t) => t.id) ?? []);
      carried.forEach((t) => {
        if (!todayIds.has(t.id) && byDate[today]) {
          const daysOverdue = daysBetween(t.assigned_date!, today);
          byDate[today].push({ ...t, carried: true, daysOverdue });
        }
      });
    }

    setTodosByDate(byDate);
    setAllTodos(todos);
  }

  useEffect(() => {
    load();
  }, [weekOffset]);

  useEffect(() => {
    const unsub1 = window.api.onNotesUpdated(load);
    const unsub2 = window.api.onSummariesUpdated(load);
    const unsub3 = window.api.onTodosUpdated(load);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  useEffect(() => {
    let last = '';
    const handler = (e: DragEvent) => {
      const el = e.target as HTMLElement;
      const label = el.className?.toString?.().slice(0, 60) ?? el.tagName;
      if (label !== last) { console.log('[drag] global dragover target:', el.tagName, label); last = label; }
    };
    document.addEventListener('dragover', handler);
    return () => document.removeEventListener('dragover', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const date = (e as CustomEvent<string>).detail;
      const targetWeekOffset = getOffsetForDate(date);
      setWeekOffset(targetWeekOffset);
      setSelectedDate(date);
    };
    window.addEventListener('search:navigate', handler);
    return () => window.removeEventListener('search:navigate', handler);
  }, []);

  async function handleTodoStatusChange(id: number, status: TodoStatus) {
    await window.api.updateTodoStatus(id, status);
  }

  if (selectedDate) {
    return (
      <DayDetail
        date={selectedDate}
        notes={notesByDate[selectedDate] ?? []}
        todos={todosByDate[selectedDate] ?? []}
        summary={summaries[selectedDate] ?? null}
        onClose={() => setSelectedDate(null)}
      />
    );
  }

  const sidebarClass = [
    styles.todoSidebar,
    panelOpen && !panelExpanded ? styles.todoSidebarOpen : '',
    panelOpen && panelExpanded  ? styles.todoSidebarExpanded : '',
  ].filter(Boolean).join(' ');

  return (
    <div class={styles.weekLayout}>
      <div class={`${styles.weekMain} ${panelOpen && panelExpanded ? styles.weekMainHidden : ''}`}>
        <div class={styles.container}>
          <div class={styles.weekHeader}>
            <div class={styles.weekNav}>
              <button class={styles.weekNavBtn} onClick={() => setWeekOffset(weekOffset - 1)} title="Previous week">‹</button>
              <span class={styles.sectionLabel}>
                {isCurrentWeek ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)}w ago`}
              </span>
              <button
                class={styles.weekNavBtn}
                onClick={() => setWeekOffset(weekOffset + 1)}
                disabled={isCurrentWeek}
                title="Next week"
              >›</button>
            </div>
            <div class={styles.tagFilterBar}>
              {(['Work', 'Win', 'Blocker', 'Learning', 'Personal'] as const).map((tag) => (
                <button
                  key={tag}
                  class={`${styles.tagFilterChip} ${activeTag === tag ? styles.tagFilterChipActive : ''}`}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button
              class={`${styles.panelToggle} ${panelOpen ? styles.panelToggleActive : ''}`}
              onClick={() => { setPanelOpen(!panelOpen); if (!panelOpen) setPanelExpanded(false); }}
              title="Toggle todos panel"
            >
              ☑ Todos
            </button>
          </div>
          <div class={styles.grid}>
            {weekDates.map((date) => {
              const filteredNotes = activeTag
                ? (notesByDate[date] ?? []).filter((n) => n.tags.includes(activeTag))
                : (notesByDate[date] ?? []);
              return (
                <DayCard
                  key={date}
                  date={date}
                  notes={filteredNotes}
                  todos={todosByDate[date] ?? []}
                  summary={summaries[date] ?? null}
                  onClick={() => setSelectedDate(date)}
                  onTodoStatusChange={handleTodoStatusChange}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div class={sidebarClass}>
        {panelOpen && (
          <TodoPanel
            todos={allTodos}
            expanded={panelExpanded}
            onToggleExpand={() => setPanelExpanded(!panelExpanded)}
            onClose={() => { setPanelOpen(false); setPanelExpanded(false); }}
          />
        )}
      </div>
    </div>
  );
}
