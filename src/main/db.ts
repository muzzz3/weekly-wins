import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

export type NoteKind = 'auto-start' | 'auto-pause' | 'auto-resume' | 'auto-done' | 'roadblock';

export interface Note {
  id: number;
  text: string;
  tags: string[];
  created_at: string;
  todo_id: number | null;
  kind: NoteKind | null;
}

export type TodoStatus = 'not-started' | 'in-progress' | 'paused' | 'done' | 'cancelled';

export interface Todo {
  id: number;
  text: string;
  status: TodoStatus;
  assigned_date: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  elapsed_ms: number | null;
  completion_summary: string | null;
  active_ms: number | null;
  segment_started_at: string | null;
  sort_order: number | null;
}

export interface DaySummary {
  date: string;        // YYYY-MM-DD
  summary: string;
  score: number;       // 0–10, AI-assessed productivity
  updated_at: string;
}

type NoteRow = Omit<Note, 'tags'> & { tags: string | null };

let db: Database.Database;

export function initDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'weekly-wins.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      text       TEXT NOT NULL,
      tags       TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);

    CREATE TABLE IF NOT EXISTS todos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      text          TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'not-started',
      assigned_date TEXT,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_todos_assigned_date ON todos(assigned_date);

    CREATE TABLE IF NOT EXISTS day_summaries (
      date       TEXT PRIMARY KEY,
      summary    TEXT NOT NULL,
      score      REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  runMigrations();
}

function runMigrations(): void {
  const notesCols = (db.pragma('table_info(notes)') as { name: string }[]).map((c) => c.name);
  if (!notesCols.includes('todo_id')) {
    db.exec(`ALTER TABLE notes ADD COLUMN todo_id INTEGER`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_todo_id ON notes(todo_id)`);
  }
  if (!notesCols.includes('kind')) {
    db.exec(`ALTER TABLE notes ADD COLUMN kind TEXT`);
  }

  const todosCols = (db.pragma('table_info(todos)') as { name: string }[]).map((c) => c.name);
  if (!todosCols.includes('started_at')) {
    db.exec(`ALTER TABLE todos ADD COLUMN started_at TEXT`);
  }
  if (!todosCols.includes('completed_at')) {
    db.exec(`ALTER TABLE todos ADD COLUMN completed_at TEXT`);
  }
  if (!todosCols.includes('elapsed_ms')) {
    db.exec(`ALTER TABLE todos ADD COLUMN elapsed_ms INTEGER`);
  }
  if (!todosCols.includes('completion_summary')) {
    db.exec(`ALTER TABLE todos ADD COLUMN completion_summary TEXT`);
  }
  if (!todosCols.includes('active_ms')) {
    db.exec(`ALTER TABLE todos ADD COLUMN active_ms INTEGER`);
  }
  if (!todosCols.includes('segment_started_at')) {
    db.exec(`ALTER TABLE todos ADD COLUMN segment_started_at TEXT`);
  }
  if (!todosCols.includes('sort_order')) {
    db.exec(`ALTER TABLE todos ADD COLUMN sort_order INTEGER`);
  }
}

function deserialize(row: NoteRow): Note {
  return { ...row, tags: JSON.parse(row.tags ?? '[]') };
}

export function insertNote(text: string, tags: string[] = [], todoId: number | null = null, kind: NoteKind | null = null): Note {
  const stmt = db.prepare(
    `INSERT INTO notes (text, tags, todo_id, kind) VALUES (?, ?, ?, ?) RETURNING *`
  );
  const row = stmt.get(text, JSON.stringify(tags), todoId, kind) as NoteRow;
  return deserialize(row);
}

export function getNotesByTodoId(todoId: number): Note[] {
  const rows = db
    .prepare(`SELECT * FROM notes WHERE todo_id = ? ORDER BY created_at ASC`)
    .all(todoId) as NoteRow[];
  return rows.map(deserialize);
}

export function getNotes(limit = 50, offset = 0): Note[] {
  const rows = db
    .prepare(`SELECT * FROM notes ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(limit, offset) as NoteRow[];
  return rows.map(deserialize);
}

export function getNotesByDateRange(from: string, to: string): Note[] {
  const rows = db
    .prepare(`SELECT * FROM notes WHERE created_at BETWEEN ? AND ? ORDER BY created_at ASC`)
    .all(from, to) as NoteRow[];
  return rows.map(deserialize);
}

export function getNotesByDate(date: string): Note[] {
  // `date` is a local calendar day (YYYY-MM-DD); convert its boundaries to UTC
  // via local-time Date parsing (no "Z" suffix) since created_at is stored in UTC.
  const from = new Date(`${date}T00:00:00.000`).toISOString();
  const to = new Date(`${date}T23:59:59.999`).toISOString();
  return getNotesByDateRange(from, to);
}

export function updateNote(id: number, text: string, tags?: string[]): Note {
  const row = tags !== undefined
    ? db.prepare(`UPDATE notes SET text = ?, tags = ? WHERE id = ? RETURNING *`).get(text, JSON.stringify(tags), id) as NoteRow
    : db.prepare(`UPDATE notes SET text = ? WHERE id = ? RETURNING *`).get(text, id) as NoteRow;
  return deserialize(row);
}

export function deleteNote(id: number): void {
  db.prepare(`DELETE FROM notes WHERE id = ?`).run(id);
}

export function upsertDaySummary(date: string, summary: string, score: number): void {
  db.prepare(`
    INSERT INTO day_summaries (date, summary, score, updated_at)
    VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(date) DO UPDATE SET
      summary    = excluded.summary,
      score      = excluded.score,
      updated_at = excluded.updated_at
  `).run(date, summary, score);
}

export function getDaySummary(date: string): DaySummary | null {
  return db.prepare(`SELECT * FROM day_summaries WHERE date = ?`).get(date) as DaySummary | null;
}

export function getDaySummariesForRange(from: string, to: string): DaySummary[] {
  return db
    .prepare(`SELECT * FROM day_summaries WHERE date BETWEEN ? AND ? ORDER BY date ASC`)
    .all(from, to) as DaySummary[];
}

export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLocalDate(): string {
  return localDateString();
}

export function insertTodo(text: string, assignedDate: string = todayLocalDate()): Todo {
  return db.prepare(
    `INSERT INTO todos (text, assigned_date) VALUES (?, ?) RETURNING *`
  ).get(text, assignedDate) as Todo;
}

export function listTodos(): Todo[] {
  return db.prepare(`
    SELECT * FROM todos ORDER BY
      CASE status
        WHEN 'in-progress'  THEN 0
        WHEN 'paused'       THEN 1
        WHEN 'not-started'  THEN 2
        WHEN 'done'         THEN 3
        WHEN 'cancelled'    THEN 4
        ELSE 5
      END,
      created_at ASC
  `).all() as Todo[];
}

export function getTodosByDate(date: string): Todo[] {
  return db.prepare(`SELECT * FROM todos WHERE assigned_date = ? ORDER BY created_at ASC`)
    .all(date) as Todo[];
}

export function updateTodoStatus(id: number, status: TodoStatus): Todo {
  return db.prepare(
    `UPDATE todos SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? RETURNING *`
  ).get(status, id) as Todo;
}

export function getTodoById(id: number): Todo | null {
  return db.prepare(`SELECT * FROM todos WHERE id = ?`).get(id) as Todo | null;
}

export function startTodo(id: number): Todo {
  return db.prepare(`
    UPDATE todos SET
      status = 'in-progress',
      started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      segment_started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      active_ms = 0,
      completed_at = NULL,
      elapsed_ms = NULL,
      completion_summary = NULL,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? RETURNING *
  `).get(id) as Todo;
}

export function resumeTodo(id: number): Todo {
  return db.prepare(`
    UPDATE todos SET
      status = 'in-progress',
      segment_started_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? RETURNING *
  `).get(id) as Todo;
}

export function pauseTodo(id: number): Todo {
  return db.prepare(`
    UPDATE todos SET
      status = 'paused',
      active_ms = COALESCE(active_ms, 0) + CASE WHEN segment_started_at IS NOT NULL
        THEN CAST((julianday(strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) - julianday(segment_started_at)) * 86400000 AS INTEGER)
        ELSE 0 END,
      segment_started_at = NULL,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? RETURNING *
  `).get(id) as Todo;
}

export function completeTodo(id: number): Todo {
  return db.prepare(`
    UPDATE todos SET
      status = 'done',
      completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      elapsed_ms = CASE WHEN started_at IS NULL THEN NULL ELSE
        COALESCE(active_ms, 0) + CASE WHEN segment_started_at IS NOT NULL
          THEN CAST((julianday(strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) - julianday(segment_started_at)) * 86400000 AS INTEGER)
          ELSE 0 END
        END,
      segment_started_at = NULL,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? RETURNING *
  `).get(id) as Todo;
}

export function setTodoCompletionSummary(id: number, summary: string): Todo {
  return db.prepare(
    `UPDATE todos SET completion_summary = ? WHERE id = ? RETURNING *`
  ).get(summary, id) as Todo;
}

export function updateTodoText(id: number, text: string): Todo {
  return db.prepare(
    `UPDATE todos SET text = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? RETURNING *`
  ).get(text, id) as Todo;
}

export function reorderTodos(orderedIds: number[]): void {
  const stmt = db.prepare(`UPDATE todos SET sort_order = ? WHERE id = ?`);
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  tx(orderedIds);
}

export function assignTodo(id: number, date: string | null): Todo {
  return db.prepare(
    `UPDATE todos SET assigned_date = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? RETURNING *`
  ).get(date, id) as Todo;
}

export function deleteTodo(id: number): void {
  db.prepare(`UPDATE notes SET todo_id = NULL WHERE todo_id = ?`).run(id);
  db.prepare(`DELETE FROM todos WHERE id = ?`).run(id);
}
