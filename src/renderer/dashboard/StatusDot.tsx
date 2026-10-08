import { useState, useEffect } from 'preact/hooks';
import type { TodoStatus } from './types.js';
import styles from './StatusDot.module.css';

export function cycleStatus(current: TodoStatus): TodoStatus {
  const order: TodoStatus[] = ['not-started', 'in-progress', 'paused', 'done', 'cancelled'];
  return order[(order.indexOf(current) + 1) % order.length];
}

const STATUS_LABELS: Record<TodoStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'paused': 'Paused',
  'done': 'Done',
  'cancelled': 'Cancelled',
};

const ALL_STATUSES: TodoStatus[] = ['not-started', 'in-progress', 'paused', 'done', 'cancelled'];

interface StatusDotProps {
  status: TodoStatus;
  size?: 'sm' | 'md';
  onChange?: (status: TodoStatus) => void;
}

export function StatusDot({ status, size = 'md', onChange }: StatusDotProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  function handleClick(e: MouseEvent) {
    if (!onChange) return;
    e.stopPropagation();
    setOpen((v) => !v);
  }

  function handleSelect(e: MouseEvent, s: TodoStatus) {
    e.stopPropagation();
    onChange?.(s);
    setOpen(false);
  }

  return (
    <div class={styles.wrapper}>
      <span
        class={`${styles.dot} ${styles[status]} ${styles[size]} ${onChange ? styles.clickable : ''}`}
        onClick={handleClick}
        title={STATUS_LABELS[status]}
      />
      {open && (
        <div class={styles.dropdown} onClick={(e) => e.stopPropagation()}>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              class={`${styles.option} ${s === status ? styles.optionActive : ''}`}
              onClick={(e) => handleSelect(e, s)}
            >
              <span class={`${styles.dot} ${styles[s]} ${styles.md}`} />
              <span class={styles.optionLabel}>{STATUS_LABELS[s]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
