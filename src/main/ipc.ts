import { ipcMain } from 'electron';
import { screen as electronScreen } from 'electron';
import { getWindow } from './windowStore.js';
import {
  insertNote, getNotes, getNotesByDateRange, getNotesByDate, getNotesByTodoId,
  updateNote, deleteNote, upsertDaySummary, getDaySummary, getDaySummariesForRange,
  insertTodo, listTodos, getTodosByDate, getTodoById, updateTodoStatus, updateTodoText, assignTodo, deleteTodo,
  startTodo, resumeTodo, pauseTodo, completeTodo, setTodoCompletionSummary, reorderTodos, localDateString,
} from './db.js';
import type { TodoStatus } from './db.js';
import { analyzeDay, generateStandup, generatePerfReview, generateTodoCompletionSummary } from './ollama.js';
import { fetchWeather, fetchAllNews } from './briefing.js';
import { shell } from 'electron';

function localDateFromISO(iso: string): string {
  return localDateString(new Date(iso));
}

async function regenerateDaySummary(date: string): Promise<void> {
  const notes = getNotesByDate(date);
  if (notes.length === 0) return;
  try {
    const { summary, score } = await analyzeDay(notes);
    upsertDaySummary(date, summary, score);
  } catch {
    // Ollama may not be running — fail silently in background
  }
}

const getFloatingBar = () => getWindow('floating');
const getDashboard = () => getWindow('dashboard');

function safeSend(channel: string, ...args: unknown[]): void {
  const win = getDashboard();
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send(channel, ...args);
  } catch {
    // Render frame disposed during HMR or navigation — ignore
  }
}

const CHANNELS = [
  'notes:save', 'notes:list', 'notes:edit', 'notes:delete', 'notes:byDateRange',
  'summary:day', 'summary:range', 'summary:generate', 'summary:regenerate-day',
  'todos:create', 'todos:list', 'todos:byDate', 'todos:updateStatus', 'todos:updateText', 'todos:assign', 'todos:delete',
  'todos:addRoadblockNote', 'todos:reorder',
  'bar:dismiss', 'bar:expand', 'dashboard:open', 'dashboard:close',
  'briefing:weather', 'briefing:news', 'briefing:openLink',
];

export function registerIpcHandlers(): void {
  // Remove any existing handlers first (safe for HMR re-registration)
  CHANNELS.forEach((ch) => ipcMain.removeHandler(ch));

  ipcMain.handle('notes:save', (_e, text: string, tags: string[]) => {
    const note = insertNote(text, tags);
    safeSend('notes:updated');

    const date = localDateFromISO(note.created_at);
    regenerateDaySummary(date).then(() => {
      safeSend('summaries:updated', date);
    });

    return note;
  });

  ipcMain.handle('notes:list', (_e, limit?: number, offset?: number) => {
    return getNotes(limit, offset);
  });

  ipcMain.handle('notes:edit', (_e, id: number, text: string, tags?: string[]) => {
    const note = updateNote(id, text, tags);
    const date = localDateFromISO(note.created_at);
    safeSend('notes:updated');
    regenerateDaySummary(date).then(() => {
      safeSend('summaries:updated', date);
    });
    return note;
  });

  ipcMain.handle('notes:delete', (_e, id: number) => {
    deleteNote(id);
  });

  ipcMain.handle('notes:byDateRange', (_e, from: string, to: string) => {
    return getNotesByDateRange(from, to);
  });

  ipcMain.handle('summary:regenerate-day', async (_e, date: string) => {
    await regenerateDaySummary(date);
    safeSend('summaries:updated', date);
  });

  ipcMain.handle('summary:day', (_e, date: string) => {
    return getDaySummary(date);
  });

  ipcMain.handle('summary:range', (_e, from: string, to: string) => {
    return getDaySummariesForRange(from, to);
  });

  ipcMain.handle('summary:generate', async (_e, type: 'standup' | 'perf', from: string, to: string, tags?: string[]) => {
    let notes = getNotesByDateRange(from, to);
    if (tags && tags.length > 0) {
      notes = notes.filter((n) => n.tags.some((t) => tags.includes(t)));
    }
    if (notes.length === 0) return 'No notes found for this date range' + (tags?.length ? ` with tags: ${tags.join(', ')}` : '') + '.';
    return type === 'standup' ? generateStandup(notes) : generatePerfReview(notes);
  });

  ipcMain.handle('todos:create', (_e, text: string) => {
    const todo = insertTodo(text);
    safeSend('todos:updated');
    return todo;
  });

  ipcMain.handle('todos:list', () => listTodos());

  ipcMain.handle('todos:byDate', (_e, date: string) => getTodosByDate(date));

  function noteSideEffects(note: ReturnType<typeof insertNote>): void {
    safeSend('notes:updated');
    safeSend('todos:updated');
    const date = localDateFromISO(note.created_at);
    regenerateDaySummary(date).then(() => safeSend('summaries:updated', date));
  }

  ipcMain.handle('todos:updateStatus', (_e, id: number, status: TodoStatus) => {
    if (status === 'in-progress') {
      const current = getTodoById(id);
      if (current?.status === 'paused') {
        const todo = resumeTodo(id);
        const note = insertNote(`Resumed: ${todo.text}`, [], id, 'auto-resume');
        noteSideEffects(note);
        return todo;
      }
      const todo = startTodo(id);
      const note = insertNote(`Started: ${todo.text}`, [], id, 'auto-start');
      noteSideEffects(note);
      return todo;
    }

    if (status === 'paused') {
      const todo = pauseTodo(id);
      const note = insertNote(`Paused: ${todo.text}`, [], id, 'auto-pause');
      noteSideEffects(note);
      return todo;
    }

    if (status === 'done') {
      const todo = completeTodo(id);
      const note = insertNote(`Completed: ${todo.text}`, [], id, 'auto-done');
      noteSideEffects(note);

      if (todo.started_at) {
        const roadblockNotes = getNotesByTodoId(id).filter((n) => n.kind === 'roadblock');
        if (roadblockNotes.length === 0) {
          // No user-provided notes to reason over — don't invoke the LLM, avoid inventing a cause.
          setTodoCompletionSummary(id, 'No notes were added, so no explanation is available.');
          safeSend('todos:updated');
        } else {
          generateTodoCompletionSummary(todo, roadblockNotes)
            .then((summary) => {
              setTodoCompletionSummary(id, summary);
              safeSend('todos:updated');
            })
            .catch(() => {
              // Ollama may not be running — fail silently in background
            });
        }
      }

      return todo;
    }

    const todo = updateTodoStatus(id, status);
    safeSend('todos:updated');
    return todo;
  });

  ipcMain.handle('todos:addRoadblockNote', (_e, todoId: number, text: string) => {
    const note = insertNote(text, [], todoId, 'roadblock');
    safeSend('notes:updated');
    const date = localDateFromISO(note.created_at);
    regenerateDaySummary(date).then(() => safeSend('summaries:updated', date));
    return note;
  });

  ipcMain.handle('todos:reorder', (_e, orderedIds: number[]) => {
    reorderTodos(orderedIds);
    safeSend('todos:updated');
  });

  ipcMain.handle('todos:updateText', (_e, id: number, text: string) => {
    const todo = updateTodoText(id, text);
    safeSend('todos:updated');
    return todo;
  });

  ipcMain.handle('todos:assign', (_e, id: number, date: string | null) => {
    const todo = assignTodo(id, date);
    safeSend('todos:updated');
    return todo;
  });

  ipcMain.handle('todos:delete', (_e, id: number) => {
    deleteTodo(id);
    safeSend('todos:updated');
  });

  ipcMain.handle('bar:dismiss', () => {
    getFloatingBar()?.hide();
  });

  ipcMain.handle('bar:expand', () => {
    const bar = getFloatingBar();
    if (!bar) return;
    const { width, height } = electronScreen.getPrimaryDisplay().bounds;
    bar.setBounds({ x: 0, y: 0, width, height });
  });

  ipcMain.handle('dashboard:open', () => {
    getDashboard()?.showInactive();
  });

  ipcMain.handle('dashboard:close', () => {
    getDashboard()?.hide();
  });

  ipcMain.handle('briefing:weather', (_e, lat?: number, lon?: number, unit?: 'F' | 'C') => fetchWeather(lat, lon, unit));
  ipcMain.handle('briefing:news', () => fetchAllNews());
  ipcMain.handle('briefing:openLink', (_e, url: string) => shell.openExternal(url));
}
