import { app, globalShortcut, BrowserWindow } from 'electron';
import { initDb } from './db.js';
import { createFloatingBar, createDashboard } from './windows.js';
import { registerIpcHandlers } from './ipc.js';

let floatingBar: BrowserWindow | null = null;
let dashboard: BrowserWindow | null = null;

app.whenReady().then(() => {
  initDb();

  floatingBar = createFloatingBar();
  dashboard = createDashboard();
  dashboard.hide();

  registerIpcHandlers();

  globalShortcut.register('CommandOrControl+Shift+W', () => {
    if (!floatingBar || floatingBar.isDestroyed()) {
      floatingBar = createFloatingBar();
    }
    if (floatingBar.isVisible()) {
      floatingBar.hide();
    } else {
      floatingBar.show();
      floatingBar.focus();
      floatingBar.webContents.send('bar:focus');
    }
  });

  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (!dashboard || dashboard.isDestroyed()) {
      dashboard = createDashboard();
    }
    if (dashboard.isVisible()) {
      dashboard.hide();
    } else {
      dashboard.show();
      dashboard.focus();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const win = dashboard?.isVisible() ? dashboard : floatingBar;
    win?.webContents.openDevTools({ mode: 'detach' });
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
