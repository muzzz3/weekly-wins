import { useState, useEffect, useRef } from 'preact/hooks';
import styles from './SummaryView.module.css';

const PRESET_TAGS = ['Work', 'Win', 'Blocker', 'Learning', 'Personal'] as const;

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d;
}

const PRESETS = [
  { label: 'This week', from: () => isoDate(startOfWeek()), to: () => isoDate(new Date()) },
  { label: 'Last week', from: () => isoDate(startOfWeek(-1)), to: () => isoDate(new Date(startOfWeek(-1).setDate(startOfWeek(-1).getDate() + 6))) },
  { label: 'Last 30d', from: () => { const d = new Date(); d.setDate(d.getDate() - 30); return isoDate(d); }, to: () => isoDate(new Date()) },
  { label: 'Last 90d', from: () => { const d = new Date(); d.setDate(d.getDate() - 90); return isoDate(d); }, to: () => isoDate(new Date()) },
];

const cache = new Map<string, string>();

function cacheKey(type: string, from: string, to: string, tags: string[]) {
  return `${type}:${from}:${to}:${tags.sort().join(',')}`;
}

export function SummaryView() {
  const [from, setFrom] = useState(isoDate(startOfWeek()));
  const [to, setTo] = useState(isoDate(new Date()));
  const [activePreset, setActivePreset] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [result, setResult] = useState('');
  const [loadingType, setLoadingType] = useState<'standup' | 'perf' | null>(null);
  const [activeType, setActiveType] = useState<'standup' | 'perf' | null>(null);
  const [error, setError] = useState('');
  const [noteCount, setNoteCount] = useState(0);
  const [copied, setCopied] = useState(false);

  async function refreshNoteCount(f = from, t = to, tags = selectedTags) {
    const notes = await window.api.getNotesByDateRange(
      new Date(`${f}T00:00:00.000`).toISOString(),
      new Date(`${t}T23:59:59.999`).toISOString(),
    );
    const filtered = tags.length > 0 ? notes.filter((n) => n.tags.some((tag) => tags.includes(tag))) : notes;
    setNoteCount(filtered.length);
    return filtered.length;
  }

  useEffect(() => {
    refreshNoteCount();
    const unsub = window.api.onNotesUpdated(() => refreshNoteCount());
    return () => unsub();
  }, [from, to, selectedTags]);

  function applyPreset(idx: number) {
    const p = PRESETS[idx];
    const f = p.from();
    const t = p.to();
    setActivePreset(idx);
    setFrom(f);
    setTo(t);
    setResult('');
    setActiveType(null);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setResult('');
    setActiveType(null);
  }

  async function generate(type: 'standup' | 'perf') {
    const key = cacheKey(type, from, to, selectedTags);
    if (cache.has(key)) {
      setResult(cache.get(key)!);
      setActiveType(type);
      return;
    }
    setLoadingType(type);
    setActiveType(type);
    setError('');
    setResult('');
    try {
      const tags = selectedTags.length > 0 ? selectedTags : undefined;
      const text = await window.api.generateSummary(
        type,
        new Date(`${from}T00:00:00.000`).toISOString(),
        new Date(`${to}T23:59:59.999`).toISOString(),
        tags,
      );
      cache.set(key, text);
      setResult(text);
    } catch (err: any) {
      setError(err?.message ?? 'Failed — is Ollama running?');
    } finally {
      setLoadingType(null);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const isLoading = loadingType !== null;

  return (
    <div class={styles.container}>
      {/* Presets */}
      <div class={styles.presetRow}>
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            class={`${styles.presetBtn} ${activePreset === i && from === PRESETS[i].from() ? styles.presetBtnActive : ''}`}
            onClick={() => applyPreset(i)}
          >
            {p.label}
          </button>
        ))}
        <div class={styles.customDates}>
          <input type="date" class={styles.dateInput} value={from}
            onChange={(e) => { setFrom((e.target as HTMLInputElement).value); setActivePreset(-1); setResult(''); setActiveType(null); }} />
          <span class={styles.dateSep}>→</span>
          <input type="date" class={styles.dateInput} value={to}
            onChange={(e) => { setTo((e.target as HTMLInputElement).value); setActivePreset(-1); setResult(''); setActiveType(null); }} />
        </div>
      </div>

      {/* Tag filter */}
      <div class={styles.tagFilterRow}>
        <span class={styles.tagFilterLabel}>Filter by tag</span>
        {PRESET_TAGS.map((tag) => (
          <button
            key={tag}
            class={`${styles.tagChip} ${selectedTags.includes(tag) ? styles.tagChipActive : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
        {selectedTags.length > 0 && (
          <button class={styles.clearTags} onClick={() => { setSelectedTags([]); setResult(''); setActiveType(null); }}>
            Clear
          </button>
        )}
      </div>

      {/* Controls row */}
      <div class={styles.controls}>
        <span class={styles.noteCountLabel}>
          {noteCount} note{noteCount !== 1 ? 's' : ''}
          {selectedTags.length > 0 ? ` tagged ${selectedTags.join(', ')}` : ''} in range
        </span>
        <div class={styles.buttons}>
          <button class={activeType === 'standup' ? styles.btnPrimary : styles.btnSecondary}
            disabled={isLoading || noteCount === 0} onClick={() => generate('standup')}>
            {loadingType === 'standup' ? '…' : 'Standup'}
          </button>
          <button class={activeType === 'perf' ? styles.btnPrimary : styles.btnSecondary}
            disabled={isLoading || noteCount === 0} onClick={() => generate('perf')}>
            {loadingType === 'perf' ? '…' : 'Perf Review'}
          </button>
        </div>
      </div>

      <div class={styles.divider} />

      <div class={styles.resultArea}>
        {isLoading ? (
          <div class={styles.loader}>
            <div class={styles.spinner} />
            <span>Generating {loadingType === 'standup' ? 'standup' : 'perf review'}…</span>
          </div>
        ) : error ? (
          <div class={styles.error}>{error}</div>
        ) : result ? (
          <div class={styles.resultWrapper}>
            <div class={styles.resultToolbar}>
              <span class={styles.resultMeta}>
                {activeType === 'standup' ? 'Standup' : 'Perf Review'}
                {selectedTags.length > 0 && ` · ${selectedTags.join(', ')}`}
              </span>
              <button class={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`} onClick={copy}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div class={styles.result}>{result}</div>
          </div>
        ) : (
          <div class={styles.placeholder}>
            {noteCount === 0
              ? 'No notes found for this range. Try a wider date range or different tags.'
              : 'Choose Standup or Perf Review to generate a summary using your local Ollama model.'}
          </div>
        )}
      </div>
    </div>
  );
}
