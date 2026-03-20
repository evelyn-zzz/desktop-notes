declare global {
  interface Window {
    api: {
      note: {
        read: () => Promise<string>
        write: (content: string) => Promise<void>
      }
      window: {
        toggleAlwaysOnTop: () => Promise<boolean>
        isAlwaysOnTop: () => Promise<boolean>
      }
      settings: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<void>
        setMode: (mode: string) => Promise<void>
        setTheme: (theme: string) => Promise<void>
      }
      on: (channel: string, callback: (...args: unknown[]) => void) => void
      off: (channel: string) => void
    }
  }
}

export {}
