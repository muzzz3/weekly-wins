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

export type NoteKind = 'auto-start' | 'auto-pause' | 'auto-resume' | 'auto-done' | 'roadblock';

export interface Note {
  id: number;
  text: string;
  tags: string[];
  created_at: string;
  todo_id: number | null;
  kind: NoteKind | null;
}

export interface WeatherData {
  temperature: number;
  unit: string;
  condition: string;
  conditionCode: number;
  windspeed: number;
  high: number;
  low: number;
  precipitationChance: number;
  location: string;
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
}

export type NewsCategory = 'top' | 'tech' | 'world' | 'science';

export interface DaySummary {
  date: string;
  summary: string;
  score: number;
  updated_at: string;
}

