import { useState, useRef, useEffect } from 'preact/hooks';
import type { Todo, TodoStatus } from './types.js';
import { StatusDot } from './StatusDot.js';
import { dragState } from './dragState.js';
import styles from './TodoPanel.module.css';

interface TodoPanelProps {
  todos: Todo[];
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

interface TodoRowProps {
  todo: Todo;
  onStatusChange: (id: number, status: TodoStatus) => void;
  onTextChange: (id: number, text: string) => void;
  onDelete: (id: number) => void;
}

function TodoRow({ todo, onStatusChange, onTextChange, onDelete }: TodoRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  // Native drag listeners — more reliable than Preact synthetic events
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    function onDragStart(e: DragEvent) {
      dragState.todoId = todo.id;
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', String(todo.id));
      console.log('[drag] dragStart (native) — todoId:', todo.id);
    }
    function onDragEnd() {
      console.log('[drag] dragEnd (native) — clearing');
      dragState.todoId = null;
    }
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    return () => {
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('dragend', onDragEnd);
    };
  }, [todo.id]);

  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === todo.text) { setEditing(false); setDraft(todo.text); return; }
    onTextChange(todo.id, trimmed);
    setEditing(false);
  }

  const dateChip = todo.assigned_date
    ? new Date(todo.assigned_date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      ref={rowRef}
      class={styles.todoRow}
      draggable
    >
      <StatusDot
        status={todo.status}
        size="md"
        onChange={(s) => onStatusChange(todo.id, s)}
      />
      <div class={styles.todoContent}>
        {editing ? (
          <input
            ref={inputRef}
            class={styles.todoEditInput}
            value={draft}
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') { setEditing(false); setDraft(todo.text); }
            }}
            onBlur={saveEdit}
          />
        ) : (
          <span
            class={`${styles.todoText} ${todo.status === 'done' || todo.status === 'cancelled' ? styles.todoTextMuted : ''}`}
            onClick={() => setEditing(true)}
          >
            {todo.text}
          </span>
        )}
        {dateChip && <span class={styles.dateChip}>{dateChip}</span>}
      </div>
      <button class={styles.deleteBtn} onClick={() => onDelete(todo.id)} title="Delete">✕</button>
    </div>
  );
}

interface SectionProps {
  label: string;
  todos: Todo[];
  defaultOpen?: boolean;
  onStatusChange: (id: number, status: TodoStatus) => void;
  onTextChange: (id: number, text: string) => void;
  onDelete: (id: number) => void;
}

function Section({ label, todos, defaultOpen = true, onStatusChange, onTextChange, onDelete }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (todos.length === 0) return null;

  return (
    <div class={styles.section}>
      <button class={styles.sectionHeader} onClick={() => setOpen(!open)}>
        <span class={styles.sectionChevron}>{open ? '▾' : '▸'}</span>
        <span class={styles.sectionLabel}>{label}</span>
        <span class={styles.sectionCount}>{todos.length}</span>
      </button>
      {open && todos.map((t) => (
        <TodoRow key={t.id} todo={t} onStatusChange={onStatusChange} onTextChange={onTextChange} onDelete={onDelete} />
      ))}
    </div>
  );
}

export function TodoPanel({ todos, expanded, onToggleExpand, onClose }: TodoPanelProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function addTodo() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await window.api.createTodo(trimmed);
    setDraft('');
    inputRef.current?.focus();
  }

  async function handleStatusChange(id: number, status: TodoStatus) {
    await window.api.updateTodoStatus(id, status);
  }

  async function handleTextChange(id: number, text: string) {
    await window.api.updateTodoText(id, text);
  }

  async function handleDelete(id: number) {
    await window.api.deleteTodo(id);
  }

  const backlog     = todos.filter((t) => !t.assigned_date);
  const inProgress  = todos.filter((t) => t.assigned_date && t.status === 'in-progress');
  const paused      = todos.filter((t) => t.assigned_date && t.status === 'paused');
  const notStarted  = todos.filter((t) => t.assigned_date && t.status === 'not-started');
  const done        = todos.filter((t) => t.assigned_date && t.status === 'done');
  const cancelled   = todos.filter((t) => t.assigned_date && t.status === 'cancelled');

  return (
    <div class={styles.panel}>
      <div class={styles.panelHeader}>
        <span class={styles.panelTitle}>Todos</span>
        <div class={styles.panelActions}>
          <button class={styles.iconBtn} onClick={onToggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '⤡' : '⤢'}
          </button>
          <button class={styles.iconBtn} onClick={onClose} title="Close">✕</button>
        </div>
      </div>

      <div class={styles.addRow}>
        <input
          ref={inputRef}
          class={styles.addInput}
          placeholder="Add a todo…"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
        />
      </div>

      <div class={styles.sections}>
        <Section label="BACKLOG" todos={backlog} onStatusChange={handleStatusChange} onTextChange={handleTextChange} onDelete={handleDelete} />
        <Section label="IN PROGRESS" todos={inProgress} onStatusChange={handleStatusChange} onTextChange={handleTextChange} onDelete={handleDelete} />
        <Section label="PAUSED" todos={paused} onStatusChange={handleStatusChange} onTextChange={handleTextChange} onDelete={handleDelete} />
        <Section label="NOT STARTED" todos={notStarted} onStatusChange={handleStatusChange} onTextChange={handleTextChange} onDelete={handleDelete} />
        <Section label="DONE" todos={done} defaultOpen={false} onStatusChange={handleStatusChange} onTextChange={handleTextChange} onDelete={handleDelete} />
        <Section label="CANCELLED" todos={cancelled} defaultOpen={false} onStatusChange={handleStatusChange} onTextChange={handleTextChange} onDelete={handleDelete} />
        {todos.length === 0 && <div class={styles.empty}>No todos yet. Add one above.</div>}
      </div>
    </div>
  );
}
