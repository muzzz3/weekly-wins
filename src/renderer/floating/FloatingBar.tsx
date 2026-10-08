import { useState, useEffect, useRef } from 'preact/hooks';
import styles from './FloatingBar.module.css';

type Mode = 'note' | 'todo';

const PRESET_TAGS = ['Work', 'Win', 'Blocker', 'Learning', 'Personal'] as const;
type PresetTag = typeof PRESET_TAGS[number];

export function FloatingBar() {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<Mode>('note');
  const [selectedTags, setSelectedTags] = useState<PresetTag[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') window.api.dismissBar(); };
    window.addEventListener('keydown', onKey);
    const unsub = window.api.onFocus(() => {
      setText('');
      setSelectedTags([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    return () => { window.removeEventListener('keydown', onKey); unsub(); };
  }, []);

  function toggleTag(tag: PresetTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (mode === 'todo') {
        await window.api.saveTodo(trimmed);
      } else {
        await window.api.saveNote(trimmed, selectedTags as string[]);
      }
      setText('');
      setSelectedTags([]);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        window.api.dismissBar();
      }, 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class={`${styles.bar} ${saved ? styles.barSaved : ''}`}>
      <div class={`${styles.dot} ${mode === 'todo' ? styles.dotTodo : ''}`} />

      <button
        class={styles.modeToggle}
        onClick={() => { setMode(mode === 'note' ? 'todo' : 'note'); setSelectedTags([]); }}
        title={mode === 'note' ? 'Switch to todo mode' : 'Switch to note mode'}
      >
        {mode === 'note' ? '📝' : '☑️'}
      </button>

      <div class={styles.inputArea}>
        <input
          ref={inputRef}
          type="text"
          class={styles.input}
          placeholder={mode === 'note' ? 'What did you just ship? · Enter to save · Esc to close' : 'What needs to be done? · Enter to save · Esc to close'}
          value={text}
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          disabled={saved}
        />
        {mode === 'note' && (
          <div class={styles.tagRow}>
            {PRESET_TAGS.map((tag) => (
              <button
                key={tag}
                class={`${styles.tagChip} ${selectedTags.includes(tag) ? styles.tagChipActive : ''}`}
                onClick={() => toggleTag(tag)}
                tabIndex={-1}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        class={styles.saveBtn}
        disabled={!text.trim() || saving || saved}
        onClick={submit}
      >
        {saving ? '…' : saved ? '✓' : 'Save'}
      </button>

      <button
        class={styles.dashBtn}
        title="Open dashboard"
        onClick={() => window.api.openDashboard()}
      >
        ⊞
      </button>
    </div>
  );
}
