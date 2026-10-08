import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  saveNote: (text: string, tags: string[]) =>
    ipcRenderer.invoke('notes:save', text, tags),
  dismissBar: () => ipcRenderer.invoke('bar:dismiss'),
  expandBar: () => ipcRenderer.invoke('bar:expand'),
  openDashboard: () => ipcRenderer.invoke('dashboard:open'),
  saveTodo: (text: string) => ipcRenderer.invoke('todos:create', text),
  onFocus: (cb: () => void) => {
    ipcRenderer.on('bar:focus', cb);
    return () => ipcRenderer.removeListener('bar:focus', cb);
  }
});