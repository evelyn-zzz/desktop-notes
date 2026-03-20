import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  note: {
    read: () => ipcRenderer.invoke('note:read'),
    write: (content: string) => ipcRenderer.invoke('note:write', content)
  },
  window: {
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop')
  }
})
