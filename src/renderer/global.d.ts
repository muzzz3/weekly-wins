import type { Note, DaySummary, Todo, TodoStatus, WeatherData, NewsArticle, NewsCategory } from './dashboard/types.js';

// Allow <webview> in Preact JSX
declare module 'preact/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      webview: {
        src?: string;
        class?: string;
        ref?: import('preact').RefObject<Electron.WebviewTag>;
        partition?: string;
        useragent?: string;
      };
    }
  }
}

declare global {
  interface Window {
    api: {
      // Floating bar
      saveNote: (text: string, tags: string[]) => Promise<unknown>;
      saveTodo: (text: string) => Promise<Todo>;
      dismissBar: () => Promise<void>;
      expandBar: () => Promise<void>;
      openDashboard: () => Promise<void>;
      onFocus: (cb: () => void) => () => void;

      // Dashboard
      listNotes: (limit?: number, offset?: number) => Promise<Note[]>;
      editNote: (id: number, text: string, tags?: string[]) => Promise<void>;
      deleteNote: (id: number) => Promise<void>;
      getNotesByDateRange: (from: string, to: string) => Promise<Note[]>;
      regenerateDaySummary: (date: string) => Promise<void>;
      getDaySummary: (date: string) => Promise<DaySummary | null>;
      getSummaryRange: (from: string, to: string) => Promise<DaySummary[]>;
      generateSummary: (type: 'standup' | 'perf', from: string, to: string, tags?: string[]) => Promise<string>;
      // Todos
      createTodo: (text: string) => Promise<Todo>;
      listTodos: () => Promise<Todo[]>;
      getTodosByDate: (date: string) => Promise<Todo[]>;
      updateTodoStatus: (id: number, status: TodoStatus) => Promise<Todo>;
      updateTodoText: (id: number, text: string) => Promise<Todo>;
      assignTodo: (id: number, date: string | null) => Promise<Todo>;
      deleteTodo: (id: number) => Promise<void>;
      addRoadblockNote: (todoId: number, text: string) => Promise<Note>;
      reorderTodos: (orderedIds: number[]) => Promise<void>;
      onTodosUpdated: (cb: () => void) => () => void;

      closeDashboard: () => Promise<void>;
      getWeather: (lat?: number, lon?: number, unit?: 'F' | 'C') => Promise<WeatherData>;
      getNews: () => Promise<Record<NewsCategory, NewsArticle[]>>;
      openLink: (url: string) => Promise<void>;
      onNotesUpdated: (cb: () => void) => () => void;
      onSummariesUpdated: (cb: (date: string) => void) => () => void;
    };
  }
}
