import { useState, useEffect, useRef } from 'preact/hooks';
import type { Note, Todo } from './types.js';
import styles from './SearchOverlay.module.css';

interface SearchResult {
  type: 'note' | 'todo';
  id: number;
  text: string;
  date: string;
  tags?: string[];
  status?: string;
}

interface SearchOverlayProps {
  onClose: () => void;
  onNavigate: (date: string) => void;
}

function highlight(text: string, query: string): string {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    `<mark>${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length)
  );
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatResultDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function SearchOverlay({ onClose, onNavigate }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Load all data once
    Promise.all([window.api.listNotes(500, 0), window.api.listTodos()]).then(([n, t]) => {
      setNotes(n);
      setTodos(t);
    });
  }, []);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const q = query.trim().toLowerCase();

  const results: SearchResult[] = q.length < 1 ? [] : [
    ...notes
      .filter((n) => n.text.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)))
      .map((n): SearchResult => ({
        type: 'note',
        id: n.id,
        text: n.text,
        date: localDate(new Date(n.created_at)),
        tags: n.tags,
      })),
    ...todos
      .filter((t) => t.text.toLowerCase().includes(q))
      .map((t): SearchResult => ({
        type: 'todo',
        id: t.id,
        text: t.text,
        date: t.assigned_date ?? localDate(new Date(t.created_at)),
        status: t.status,
      })),
  ].slice(0, 30);

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) {
      onNavigate(results[selectedIdx].date);
      onClose();
    }
  }

  const STATUS_ICONS: Record<string, string> = {
    'not-started': '○', 'in-progress': '◑', 'done': '●', 'cancelled': '✕',
  };

  return (
    <div class={styles.overlay} onMouseDown={onClose}>
      <div class={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        <div class={styles.inputRow}>
          <span class={styles.searchIcon}>⌕</span>
          <input
            ref={inputRef}
            class={styles.input}
            placeholder="Search notes and todos…"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={handleKey}
          />
          {query && (
            <button class={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {q.length > 0 && (
          <div class={styles.results}>
            {results.length === 0 ? (
              <div class={styles.empty}>No results for "{query}"</div>
            ) : (
              <>
                <div class={styles.resultCount}>{results.length} result{results.length !== 1 ? 's' : ''}</div>
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    class={`${styles.resultRow} ${i === selectedIdx ? styles.resultRowActive : ''}`}
                    onClick={() => { onNavigate(r.date); onClose(); }}
                    onMouseEnter={() => setSelectedIdx(i)}
                  >
                    <span class={styles.resultTypeIcon}>
                      {r.type === 'note' ? '📝' : STATUS_ICONS[r.status ?? 'not-started']}
                    </span>
                    <div class={styles.resultBody}>
                      <span
                        class={styles.resultText}
                        dangerouslySetInnerHTML={{ __html: highlight(r.text, query) }}
                      />
                      {r.tags && r.tags.length > 0 && (
                        <div class={styles.resultTags}>
                          {r.tags.map((t) => <span key={t} class={styles.resultTag}>{t}</span>)}
                        </div>
                      )}
                    </div>
                    <span class={styles.resultDate}>{formatResultDate(r.date)}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {q.length === 0 && (
          <div class={styles.hint}>Type to search across all notes and todos</div>
        )}
      </div>
    </div>
  );
}
