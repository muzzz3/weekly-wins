import type { NewsCategory } from './types.js';

export type TempUnit = 'F' | 'C';

export interface AppSettings {
  theme: 'dark' | 'blue' | 'sakura';
  tempUnit: TempUnit;
  location: { lat: number; lon: number; city: string } | null;
  newsCategories: NewsCategory[];
}

const DEFAULTS: AppSettings = {
  theme: 'dark',
  tempUnit: 'F',
  location: null,
  newsCategories: ['top', 'tech', 'world', 'science'],
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('app-settings');
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem('app-settings', JSON.stringify(s));
}
