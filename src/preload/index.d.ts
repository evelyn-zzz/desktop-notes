export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'installing'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  latestVersion?: string
  releaseNotes?: string
  downloadUrl?: string
  assetName?: string
  progress?: number
  message?: string
}

declare global {
  interface Window {
    api: {
      note: {
        read: () => Promise<string>
        write: (content: string) => Promise<void>
      }
      clipboard: {
        writeText: (text: string) => Promise<void>
      }
      updater: {
        getState: () => Promise<UpdateState>
        check: () => Promise<UpdateState>
        install: () => Promise<void>
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
