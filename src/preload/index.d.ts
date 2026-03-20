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
    }
  }
}

export {}
