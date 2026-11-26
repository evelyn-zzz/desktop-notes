import { app, BrowserWindow, dialog, net } from 'electron'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const execFileAsync = promisify(execFile)

const GITHUB_OWNER = 'evelyn-zzz'
const GITHUB_REPO = 'desktop-notes'
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
const REQUEST_TIMEOUT_MS = 15000

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

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
}

interface GitHubRelease {
  tag_name: string
  name?: string
  body?: string
  assets?: GitHubAsset[]
}

let state: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion()
}

let activeCheckPromise: Promise<UpdateState> | null = null
let activeInstallPromise: Promise<void> | null = null

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

function setState(patch: Partial<UpdateState>): UpdateState {
  state = {
    ...state,
    ...patch,
    currentVersion: app.getVersion()
  }
  getWindow()?.webContents.send('updater:status', state)
  return state
}

export function getUpdateState(): UpdateState {
  return { ...state, currentVersion: app.getVersion() }
}

function parseVersionParts(version: string): number[] {
  const cleaned = version.trim().replace(/^v/i, '').split('-')[0]
  return cleaned.split('.').map((part) => {
    const num = Number.parseInt(part, 10)
    return Number.isNaN(num) ? 0 : num
  })
}

export function compareVersions(a: string, b: string): number {
  const partsA = parseVersionParts(a)
  const partsB = parseVersionParts(b)
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0
    const numB = partsB[i] ?? 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

function selectMacZipAsset(assets: GitHubAsset[]): GitHubAsset | undefined {
  const zips = assets.filter((asset) => asset.name.toLowerCase().endsWith('.zip'))
  if (zips.length === 0) return undefined

  const lower = (asset: GitHubAsset) => asset.name.toLowerCase()
  const universal = zips.find((a) => lower(a).includes('universal'))

  if (process.arch === 'arm64') {
    return (
      zips.find((a) => lower(a).includes('arm64')) ??
      universal ??
      zips.find((a) => !lower(a).includes('x64') && !lower(a).includes('ia32'))
    )
  }

  return (
    zips.find((a) => lower(a).includes('x64')) ??
    zips.find((a) => !lower(a).includes('arm64') && !lower(a).includes('universal')) ??
    universal
  )
}

function resolvePackagedAppPath(): string | null {
  if (!app.isPackaged) return null
  // Electron macOS 可执行文件路径为 <AppName>.app/Contents/MacOS/<Binary>
  const bundlePath = path.resolve(process.execPath, '../../..')
  if (!bundlePath.endsWith('.app') || !fs.existsSync(bundlePath)) return null
  return bundlePath
}

async function promptInstall(latestVersion: string, releaseNotes?: string): Promise<boolean> {
  const win = getWindow()
  const detail = releaseNotes?.trim()
    ? `当前版本：v${app.getVersion()}\n最新版本：v${latestVersion}\n\n更新内容：\n${releaseNotes.trim()}`
    : `当前版本：v${app.getVersion()}\n最新版本：v${latestVersion}`

  const options: Electron.MessageBoxOptions = {
    type: 'info',
    title: '发现新版本',
    message: `发现 Desktop Notes v${latestVersion}`,
    detail,
    buttons: ['立即下载并安装', '稍后'],
    defaultId: 0,
    cancelId: 1
  }

  const result = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options)
  return result.response === 0
}

async function showMessage(title: string, message: string, detail?: string, type: 'info' | 'error' = 'info') {
  const win = getWindow()
  const options: Electron.MessageBoxOptions = { type, title, message, detail, buttons: ['确定'] }
  if (win) {
    await dialog.showMessageBox(win, options)
  } else {
    await dialog.showMessageBox(options)
  }
}

export async function checkForUpdates(options: { manual?: boolean } = {}): Promise<UpdateState> {
  if (activeCheckPromise) return activeCheckPromise

  const manual = options.manual ?? false
  activeCheckPromise = (async () => {
    setState({ status: 'checking', message: undefined, progress: undefined })

    try {
      const response = await net.fetch(RELEASES_API_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `${GITHUB_REPO}-updater`
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })

      if (response.status === 404) {
        const next = setState({ status: 'not-available', message: '暂无已发布的线上版本' })
        if (manual) {
          await showMessage('检查更新', '暂无已发布的线上版本', `当前版本：v${app.getVersion()}`)
        }
        return next
      }

      if (!response.ok) {
        throw new Error(`GitHub API 请求失败 (${response.status})`)
      }

      const release = (await response.json()) as GitHubRelease
      const latestVersion = release.tag_name.replace(/^v/i, '')

      if (compareVersions(latestVersion, app.getVersion()) <= 0) {
        const next = setState({
          status: 'not-available',
          latestVersion,
          message: '当前已是最新版本'
        })
        if (manual) {
          await showMessage('检查更新', '当前已是最新版本', `Desktop Notes v${app.getVersion()} 已是最新版本。`)
        }
        return next
      }

      const asset = selectMacZipAsset(release.assets ?? [])
      if (!asset) {
        throw new Error(`v${latestVersion} 缺少适用于 ${process.arch} 的 .zip 更新包`)
      }

      const next = setState({
        status: 'available',
        latestVersion,
        releaseNotes: release.body,
        downloadUrl: asset.browser_download_url,
        assetName: asset.name,
        message: undefined
      })

      if (manual) {
        const shouldInstall = await promptInstall(latestVersion, release.body)
        if (shouldInstall) {
          void downloadAndInstallUpdate()
        }
      }

      return next
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '检查更新失败'
      const next = setState({ status: 'error', message: errMsg })
      if (manual) {
        await showMessage('检查更新失败', '无法获取版本信息', errMsg, 'error')
      }
      return next
    } finally {
      activeCheckPromise = null
    }
  })()

  return activeCheckPromise
}

async function downloadFileWithProgress(url: string, destPath: string): Promise<void> {
  const response = await net.fetch(url, {
    headers: { 'User-Agent': `${GITHUB_REPO}-updater` }
  })
  if (!response.ok || !response.body) {
    throw new Error(`下载更新包失败 (${response.status})`)
  }

  const totalBytes = Number.parseInt(response.headers.get('content-length') ?? '0', 10)
  let downloadedBytes = 0
  let lastPercent = -1

  const webStream = response.body as unknown as AsyncIterable<Uint8Array>
  const nodeStream = Readable.from(
    (async function* () {
      for await (const chunk of webStream) {
        downloadedBytes += chunk.byteLength
        if (totalBytes > 0) {
          const percent = Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100))
          if (percent !== lastPercent) {
            lastPercent = percent
            setState({ status: 'downloading', progress: percent })
          }
        }
        yield chunk
      }
    })()
  )

  await pipeline(nodeStream, fs.createWriteStream(destPath))
}

function findExtractedApp(extractDir: string): string | null {
  const entries = fs.readdirSync(extractDir, { withFileTypes: true })
  const appEntry = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
  if (!appEntry) return null
  const candidate = path.join(extractDir, appEntry.name)
  // 校验包结构完整，避免用损坏目录替换原应用
  if (!fs.existsSync(path.join(candidate, 'Contents', 'MacOS'))) return null
  return candidate
}

function hasWritePermission(targetPath: string): boolean {
  try {
    fs.accessSync(path.dirname(targetPath), fs.constants.W_OK)
    fs.accessSync(targetPath, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

export async function downloadAndInstallUpdate(): Promise<void> {
  if (activeInstallPromise) return activeInstallPromise

  activeInstallPromise = (async () => {
    if (process.platform !== 'darwin') {
      await showMessage('暂不支持', '自动替换更新仅支持 macOS。', undefined, 'error')
      return
    }

    const targetAppPath = resolvePackagedAppPath()
    if (!targetAppPath) {
      setState({
        status: 'error',
        message: '开发模式下不支持覆盖安装'
      })
      await showMessage(
        '无法自动安装',
        '当前为开发模式运行，无法执行覆盖安装。',
        '请使用打包后的 Desktop Notes.app 测试自动更新。',
        'error'
      )
      return
    }

    if (!state.downloadUrl || !state.latestVersion) {
      const checked = await checkForUpdates({ manual: false })
      if (checked.status !== 'available' || !checked.downloadUrl) {
        await showMessage('暂无更新', checked.message ?? '当前没有可安装的更新版本。')
        return
      }
    }

    const workDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'desktop-notes-update-'))
    const zipPath = path.join(workDir, state.assetName ?? 'update.zip')
    const extractDir = path.join(workDir, 'extracted')

    try {
      setState({ status: 'downloading', progress: 0, message: undefined })
      await downloadFileWithProgress(state.downloadUrl!, zipPath)

      setState({ status: 'installing', progress: 100 })
      fs.mkdirSync(extractDir, { recursive: true })
      await execFileAsync('ditto', ['-xk', zipPath, extractDir])

      const newAppPath = findExtractedApp(extractDir)
      if (!newAppPath) {
        throw new Error('解压后的更新包未包含有效的应用目录')
      }

      // 独立脚本在主进程退出后执行原子替换、清除隔离属性并重新拉起应用
      const scriptPath = path.join(workDir, 'apply-update.sh')
      const scriptContent = [
        '#!/bin/sh',
        'PID="$1"',
        'NEW_APP="$2"',
        'TARGET_APP="$3"',
        'WORK_DIR="$4"',
        'BACKUP_APP="${TARGET_APP}.bak"',
        'i=0',
        'while kill -0 "$PID" 2>/dev/null && [ $i -lt 30 ]; do',
        '  sleep 0.5',
        '  i=$((i + 1))',
        'done',
        'rm -rf "$BACKUP_APP"',
        'if ! mv "$TARGET_APP" "$BACKUP_APP"; then',
        '  exit 1',
        'fi',
        'if ! mv "$NEW_APP" "$TARGET_APP"; then',
        '  mv "$BACKUP_APP" "$TARGET_APP"',
        '  exit 1',
        'fi',
        'rm -rf "$BACKUP_APP"',
        'xattr -rd com.apple.quarantine "$TARGET_APP" 2>/dev/null || true',
        'open -n "$TARGET_APP"',
        'rm -rf "$WORK_DIR"',
        ''
      ].join('\n')
      fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 })

      if (hasWritePermission(targetAppPath)) {
        const child = spawn(
          '/bin/sh',
          [scriptPath, String(process.pid), newAppPath, targetAppPath, workDir],
          { detached: true, stdio: 'ignore' }
        )
        child.unref()
      } else {
        // 目标目录无写权限（如非管理员安装的 /Applications）时请求系统管理员授权
        const escaped = (val: string) => `'${val.replace(/'/g, "'\\''")}'`
        const shellCmd = `nohup /bin/sh ${escaped(scriptPath)} ${process.pid} ${escaped(newAppPath)} ${escaped(targetAppPath)} ${escaped(workDir)} >/dev/null 2>&1 &`
        const appleScript = `do shell script "${shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with administrator privileges`
        await execFileAsync('osascript', ['-e', appleScript])
      }

      app.quit()
    } catch (err) {
      fs.rmSync(workDir, { recursive: true, force: true })
      const errMsg = err instanceof Error ? err.message : '安装更新失败'
      setState({ status: 'error', message: errMsg, progress: undefined })
      await showMessage('更新失败', '自动下载或安装更新时出错', errMsg, 'error')
    }
  })().finally(() => {
    activeInstallPromise = null
  })

  return activeInstallPromise
}
