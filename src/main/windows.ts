import { BrowserWindow, screen, app } from 'electron';
import { join } from 'path';
import { setWindow } from './windowStore.js';

const isDev = process.env.NODE_ENV === 'development';

export function createFloatingBar(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const barWidth = 680;
  const barHeight = 110;

  const win = new BrowserWindow({
    width: barWidth,
    height: barHeight,
    x: Math.round((width - barWidth) / 2),
    y: Math.round((height - barHeight) / 2),
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/floating.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/floating/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/floating/index.html'));
  }

  win.on('close', (e) => {
    e.preventDefault();
    win.hide();
  });

  let justShown = false;

  win.on('show', () => {
    justShown = true;
    setTimeout(() => { justShown = false; }, 300);
  });

  app.on('browser-window-focus', (_e, focusedWin) => {
    if (!justShown && focusedWin !== win && win.isVisible()) win.hide();
  });

  app.on('browser-window-blur', () => {
    setTimeout(() => {
      if (!justShown && win.isVisible() && !win.isFocused()) win.hide();
    }, 150);
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  setWindow('floating', win);
  return win;
}

export function createDashboard(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/dashboard.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    }
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/dashboard/index.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/dashboard/index.html'));
  }

  win.on('close', (e) => {
    e.preventDefault();
    win.hide();
  });


  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  setWindow('dashboard', win);
  return win;
}
