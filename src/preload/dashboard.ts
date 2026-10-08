import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  listNotes: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('notes:list', limit, offset),
  editNote: (id: number, text: string, tags?: string[]) =>
    ipcRenderer.invoke('notes:edit', id, text, tags),
  deleteNote: (id: number) =>
    ipcRenderer.invoke('notes:delete', id),
  getNotesByDateRange: (from: string, to: string) =>
    ipcRenderer.invoke('notes:byDateRange', from, to),
  generateSummary: (type: 'standup' | 'perf', from: string, to: string, tags?: string[]) =>
    ipcRenderer.invoke('summary:generate', type, from, to, tags),
  regenerateDaySummary: (date: string) =>
    ipcRenderer.invoke('summary:regenerate-day', date),
  getDaySummary: (date: string) =>
    ipcRenderer.invoke('summary:day', date),
  getSummaryRange: (from: string, to: string) =>
    ipcRenderer.invoke('summary:range', from, to),
  onNotesUpdated: (cb: () => void) => {
    ipcRenderer.on('notes:updated', cb);
    return () => ipcRenderer.removeListener('notes:updated', cb);
  },
  createTodo: (text: string) => ipcRenderer.invoke('todos:create', text),
  listTodos: () => ipcRenderer.invoke('todos:list'),
  getTodosByDate: (date: string) => ipcRenderer.invoke('todos:byDate', date),
  updateTodoStatus: (id: number, status: string) => ipcRenderer.invoke('todos:updateStatus', id, status),
  updateTodoText: (id: number, text: string) => ipcRenderer.invoke('todos:updateText', id, text),
  assignTodo: (id: number, date: string | null) => ipcRenderer.invoke('todos:assign', id, date),
  deleteTodo: (id: number) => ipcRenderer.invoke('todos:delete', id),
  addRoadblockNote: (todoId: number, text: string) => ipcRenderer.invoke('todos:addRoadblockNote', todoId, text),
  reorderTodos: (orderedIds: number[]) => ipcRenderer.invoke('todos:reorder', orderedIds),
  onTodosUpdated: (cb: () => void) => {
    ipcRenderer.on('todos:updated', cb);
    return () => ipcRenderer.removeListener('todos:updated', cb);
  },
  closeDashboard: () => ipcRenderer.invoke('dashboard:close'),
  getWeather: (lat?: number, lon?: number, unit?: 'F' | 'C') => ipcRenderer.invoke('briefing:weather', lat, lon, unit),
  getNews: () => ipcRenderer.invoke('briefing:news'),
  openLink: (url: string) => ipcRenderer.invoke('briefing:openLink', url),
  onSummariesUpdated: (cb: (date: string) => void) => {
    const wrapped = (_e: Electron.IpcRendererEvent, date: string) => cb(date);
    ipcRenderer.on('summaries:updated', wrapped);
    return () => ipcRenderer.removeListener('summaries:updated', wrapped);
  }
});
