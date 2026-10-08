import { useState, useEffect } from 'preact/hooks';
import type { AppSettings, TempUnit } from './settings.js';
import type { NewsCategory } from './types.js';
import styles from './SettingsPanel.module.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  onClose: () => void;
}

interface GeoResult {
  lat: string;
  lon: string;
  display_name: string;
}

const ALL_CATEGORIES: { key: NewsCategory; label: string }[] = [
  { key: 'top',     label: 'Top Headlines' },
  { key: 'tech',    label: 'Technology' },
  { key: 'world',   label: 'World' },
  { key: 'science', label: 'Science' },
];

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const [closing, setClosing] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function dismiss() {
    setClosing(true);
    setTimeout(onClose, 195);
  }

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  function toggleCategory(cat: NewsCategory) {
    const current = settings.newsCategories;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    if (next.length === 0) return; // keep at least one
    set('newsCategories', next);
  }

  async function searchLocation() {
    const q = locationQuery.trim();
    if (!q) return;
    setSearching(true);
    setGeoResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { 'User-Agent': 'weekly-wins-app' } }
      );
      const data = await res.json() as GeoResult[];
      setGeoResults(data);
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  }

  function selectLocation(r: GeoResult) {
    const city = r.display_name.split(',')[0].trim();
    set('location', { lat: parseFloat(r.lat), lon: parseFloat(r.lon), city });
    setLocationQuery('');
    setGeoResults([]);
  }

  function clearLocation() {
    set('location', null);
    setLocationQuery('');
    setGeoResults([]);
  }

  return (
    <div class={styles.overlay}>
      <div class={`${styles.panel} ${closing ? styles.panelClosing : ''}`}>
        <div class={styles.header}>
          <span class={styles.title}>Settings</span>
          <button class={styles.closeBtn} onClick={dismiss}>✕</button>
        </div>

        <div class={styles.body}>

          {/* ── Appearance ── */}
          <section class={styles.section}>
            <div class={styles.sectionLabel}>Appearance</div>
            <div class={styles.row}>
              <span class={styles.rowLabel}>Theme</span>
              <div class={styles.segmented}>
                {(['dark', 'blue', 'sakura'] as const).map((t) => (
                  <button
                    key={t}
                    class={`${styles.segBtn} ${settings.theme === t ? styles.segBtnActive : ''}`}
                    onClick={() => set('theme', t)}
                  >
                    {t === 'dark' ? '🌙 Dark' : t === 'blue' ? '🩵 Blue' : '🌸 Sakura'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Weather ── */}
          <section class={styles.section}>
            <div class={styles.sectionLabel}>Weather</div>

            <div class={styles.row}>
              <span class={styles.rowLabel}>Temperature</span>
              <div class={styles.segmented}>
                {(['F', 'C'] as TempUnit[]).map((u) => (
                  <button
                    key={u}
                    class={`${styles.segBtn} ${settings.tempUnit === u ? styles.segBtnActive : ''}`}
                    onClick={() => set('tempUnit', u)}
                  >
                    °{u}
                  </button>
                ))}
              </div>
            </div>

            <div class={styles.locationRow}>
              <span class={styles.rowLabel}>Location</span>
              {settings.location ? (
                <div class={styles.locationCurrent}>
                  <span class={styles.locationName}>{settings.location.city}</span>
                  <button class={styles.locationClear} onClick={clearLocation}>Change</button>
                </div>
              ) : (
                <span class={styles.locationAuto}>Automatic (IP / GPS)</span>
              )}
            </div>

            <div class={styles.locationSearch}>
              <div class={styles.searchRow}>
                <input
                  class={styles.searchInput}
                  placeholder="Search for a city…"
                  value={locationQuery}
                  onInput={(e) => setLocationQuery((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
                />
                <button class={styles.searchBtn} onClick={searchLocation} disabled={searching}>
                  {searching ? '…' : 'Search'}
                </button>
              </div>
              {geoResults.length > 0 && (
                <div class={styles.geoResults}>
                  {geoResults.map((r, i) => (
                    <button key={i} class={styles.geoResult} onClick={() => selectLocation(r)}>
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── News ── */}
          <section class={styles.section}>
            <div class={styles.sectionLabel}>News Categories</div>
            <div class={styles.categories}>
              {ALL_CATEGORIES.map(({ key, label }) => (
                <button
                  key={key}
                  class={`${styles.catBtn} ${settings.newsCategories.includes(key) ? styles.catBtnActive : ''}`}
                  onClick={() => toggleCategory(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
