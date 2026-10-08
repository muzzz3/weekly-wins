import { BrowserWindow } from 'electron';

const ids = new Map<string, number>();

export function setWindow(name: string, win: BrowserWindow): void {
  ids.set(name, win.id);
}

export function getWindow(name: string): BrowserWindow | undefined {
  const id = ids.get(name);
  if (id === undefined) return undefined;
  const win = BrowserWindow.fromId(id);
  if (!win || win.isDestroyed()) return undefined;
  return win;
}
