import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  note: {
    read: () => ipcRenderer.invoke('note:read'),
    write: (content: string) => ipcRenderer.invoke('note:write', content)
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text)
  },
  window: {
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window:toggleAlwaysOnTop'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:isAlwaysOnTop')
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    setMode: (mode: string) => ipcRenderer.invoke('mode:set', mode),
    setTheme: (theme: string) => ipcRenderer.invoke('theme:set', theme)
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
