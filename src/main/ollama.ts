import { Ollama } from 'ollama';
import type { Note, Todo } from './db.js';
import { localDateString } from './db.js';

const ollama = new Ollama({ host: 'http://localhost:11434' });
const FAST_MODEL = 'llama3.2';   // background scoring + daily summaries
const PROSE_MODEL = 'mistral';   // standup + perf review

function formatNotes(notes: Note[]): string {
  return notes
    .map((n) => `- ${n.created_at.slice(11, 16)}: ${n.text}`)
    .join('\n');
}

export interface DayAnalysis {
  summary: string;
  score: number;
}

export async function analyzeDay(notes: Note[]): Promise<DayAnalysis> {
  const formatted = formatNotes(notes);

  const [summaryRes, scoreRes] = await Promise.all([
    ollama.chat({
      model: FAST_MODEL,
      messages: [{
        role: 'user',
        content: `You are summarizing an engineer's workday from their quick notes.
Write a concise 1-2 sentence summary in first person.
STRICT RULES:
- Only use information explicitly stated in the notes below. Do NOT invent, infer, or embellish.
- If the notes mention an absence or errand, reflect that honestly.
- Do not add tasks, accomplishments, or details that are not in the notes.

Notes:
${formatted}`
      }]
    }),
    ollama.chat({
      model: FAST_MODEL,
      messages: [{
        role: 'user',
        content: `You are evaluating an engineer's productivity from their work notes.
Rate how productive this day was from 0 to 10 based purely on the quality and impact of the work described.
IMPORTANT: Do NOT penalize for having few notes — one note describing meaningful work should score just as high as ten notes.
A 10 means impactful, meaningful progress. A 5 is a solid, normal day. A 0 means completely blocked or no progress at all.
Judge the substance of what was accomplished, not how much was written.
Respond with ONLY a single number between 0 and 10. No explanation.

Notes:
${formatted}`
      }]
    })
  ]);

  const raw = scoreRes.message.content.trim();
  const score = Math.min(10, Math.max(0, parseFloat(raw) || 5));

  return { summary: summaryRes.message.content.trim(), score };
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export async function generateTodoCompletionSummary(todo: Todo, notes: Note[]): Promise<string> {
  const roadblockNotes = notes.filter((n) => n.kind === 'roadblock');
  const elapsed = todo.elapsed_ms != null ? formatElapsed(todo.elapsed_ms) : 'unknown time';

  const response = await ollama.chat({
    model: FAST_MODEL,
    messages: [{
      role: 'user',
      content: `You are reasoning about how long a task took an engineer, based only on their own notes.

Task: "${todo.text}"
Time taken: ${elapsed} (started ${todo.started_at ?? 'unknown'}, completed ${todo.completed_at ?? 'unknown'}).

Write a 1-2 sentence note explaining why the task took this long, in first person.
STRICT RULES:
- Only use information explicitly stated in the notes below. Do NOT invent, infer, or embellish causes.
- If there are no roadblock notes below (only start/completion markers), write exactly: "Completed with no recorded obstacles."
- Be concise and factual.

${roadblockNotes.length === 0 ? 'Notes: (none besides start/completion markers)' : `Roadblock notes:\n${formatNotes(roadblockNotes)}`}`
    }]
  });

  return response.message.content.trim();
}

export async function generateStandup(notes: Note[]): Promise<string> {
  const today = localDateString();
  const yesterday = localDateString(new Date(Date.now() - 86400000));

  const todayNotes = notes.filter(n => localDateString(new Date(n.created_at)) === today);
  const yesterdayNotes = notes.filter(n => localDateString(new Date(n.created_at)) === yesterday);

  const section = (label: string, items: Note[]) =>
    `${label} (${items.length === 0 ? 'no notes' : items.map(n => n.text).join('; ')})`;

  const response = await ollama.chat({
    model: PROSE_MODEL,
    messages: [{
      role: 'user',
      content: `You are a helpful assistant that writes concise engineering standups.
Today is ${today}. Yesterday was ${yesterday}.

Write a standup with three sections: **Yesterday**, **Today**, **Blockers**.
STRICT RULES:
- Only use the notes provided below. Do NOT invent or assume anything.
- If a section has no notes, write exactly "Nothing logged."
- For Blockers: only mention a blocker if one is explicitly stated in the notes. Otherwise write "None."
- Be concise, first person.

${section('Yesterday notes', yesterdayNotes)}
${section('Today notes', todayNotes)}`
    }]
  });
  return response.message.content;
}

export async function generatePerfReview(notes: Note[]): Promise<string> {
  const response = await ollama.chat({
    model: PROSE_MODEL,
    messages: [{
      role: 'user',
      content: `You are a helpful assistant that writes impactful performance review self-assessments.
Given these work notes, write a self-assessment summary that highlights impact, scope, and growth.
Use strong action verbs. Group by theme if possible. 2-4 paragraphs.

Work notes:
${formatNotes(notes)}`
    }]
  });
  return response.message.content;
}
