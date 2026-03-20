import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SAVE_DELAY = 500

type Mode = 'split' | 'edit' | 'preview'
type Theme = 'yellow' | 'gray' | 'mint' | 'blue'

const themes: Record<Theme, {
  root: string
  titleBar: string
  border: string
  editor: string
  preview: string
  pin: string
  pinActive: string
}> = {
  yellow: {
    root: 'bg-amber-50',
    titleBar: 'bg-amber-100 border-amber-200',
    border: 'border-amber-200',
    editor: 'bg-amber-50',
    preview: 'bg-amber-50',
    pin: 'bg-amber-200 text-amber-600 hover:bg-amber-300',
    pinActive: 'bg-amber-400 text-amber-900'
  },
  gray: {
    root: 'bg-slate-50',
    titleBar: 'bg-slate-100 border-slate-200',
    border: 'border-slate-200',
    editor: 'bg-slate-50',
    preview: 'bg-slate-50',
    pin: 'bg-slate-200 text-slate-600 hover:bg-slate-300',
    pinActive: 'bg-slate-400 text-slate-900'
  },
  mint: {
    root: 'bg-emerald-50',
    titleBar: 'bg-emerald-100 border-emerald-200',
    border: 'border-emerald-200',
    editor: 'bg-emerald-50',
    preview: 'bg-emerald-50',
    pin: 'bg-emerald-200 text-emerald-600 hover:bg-emerald-300',
    pinActive: 'bg-emerald-400 text-emerald-900'
  },
  blue: {
    root: 'bg-sky-50',
    titleBar: 'bg-sky-100 border-sky-200',
    border: 'border-sky-200',
    editor: 'bg-sky-50',
    preview: 'bg-sky-50',
    pin: 'bg-sky-200 text-sky-600 hover:bg-sky-300',
    pinActive: 'bg-sky-400 text-sky-900'
  }
}

export default function App() {
  const [content, setContent] = useState('')
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [mode, setMode] = useState<Mode>('split')
  const [theme, setTheme] = useState<Theme>('yellow')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.note.read().then(setContent)

    window.api.on('init', (v) => {
      const { mode, theme, alwaysOnTop } = v as { mode: Mode; theme: Theme; alwaysOnTop: boolean }
      setMode(mode)
      setTheme(theme)
      setAlwaysOnTop(alwaysOnTop)
    })
    window.api.on('mode:change', (v) => setMode(v as Mode))
    window.api.on('theme:change', (v) => setTheme(v as Theme))

    return () => {
      window.api.off('init')
      window.api.off('mode:change')
      window.api.off('theme:change')
    }
  }, [])

  const handleChange = useCallback((val: string) => {
    setContent(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      window.api.note.write(val)
    }, SAVE_DELAY)
  }, [])

  // ref 持有最新 content，handleToggleTodo 不再依赖 content
  const contentRef = useRef('')
  contentRef.current = content

  const handleToggleTodo = useCallback((index: number) => {
    const lines = contentRef.current.split('\n')
    let count = 0
    const updated = lines.map((line) => {
      const unchecked = line.match(/^(\s*-\s)\[ \](.*)/)
      const checked = line.match(/^(\s*-\s)\[x\](.*)/i)
      if (unchecked || checked) {
        if (count === index) {
          count++
          return unchecked
            ? line.replace('[ ]', '[x]')
            : line.replace(/\[x\]/i, '[ ]')
        }
        count++
      }
      return line
    })
    handleChange(updated.join('\n'))
  }, [handleChange])

  // render 时重置计数器，不用 useMemo
  const cbIndexRef = useRef(0)
  cbIndexRef.current = 0

  const checkboxComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-xl font-bold mt-3 mb-1">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-lg font-semibold mt-2 mb-1">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-base font-medium mt-2 mb-1">{children}</h3>
    ),
    ul: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <ul className={`${className?.includes('contains-task-list') ? '' : 'list-disc'} pl-5 my-1 space-y-0.5`}>
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>
    ),
    li: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <li className={`leading-relaxed ${className?.includes('task-list-item') ? 'list-none -ml-5' : ''}`}>
        {children}
      </li>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="my-1 leading-relaxed">{children}</p>
    ),
    hr: () => <hr className="my-3 border-t border-gray-200" />,
    input: ({ checked, disabled: _disabled, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
      const currentIndex = cbIndexRef.current++
      return (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={() => handleToggleTodo(currentIndex)}
          className="mr-1.5 cursor-pointer"
          {...props}
        />
      )
    }
  }

  const toggleAlwaysOnTop = async () => {
    const next = await window.api.window.toggleAlwaysOnTop()
    setAlwaysOnTop(next)
  }

  const cycleMode = async () => {
    const next: Mode = mode === 'edit' ? 'preview' : 'edit'
    setMode(next)
    await window.api.settings.setMode(next)
  }

  const modeLabel: Record<Mode, string> = { split: '分屏', edit: '编辑', preview: '预览' }

  const t = themes[theme]

  return (
    <div className={`flex flex-col h-screen ${t.root} rounded-xl overflow-hidden shadow-2xl`}>
      {/* 标题栏 — 极简 */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 ${t.titleBar} border-b`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* 红绿灯占位 */}
        <div className="w-14" />
        {/* 右侧按钮组 */}
        <div
          className="flex items-center gap-1.5"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={cycleMode}
            title="切换模式"
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${t.pin}`}
          >
            {modeLabel[mode]}
          </button>
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? '取消置顶' : '置顶'}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              alwaysOnTop ? t.pinActive : t.pin
            }`}
          >
            📌
          </button>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 编辑区 */}
        {(mode === 'split' || mode === 'edit') && (
          <textarea
            className={`${mode === 'split' ? 'flex-1' : 'w-full'} p-4 ${t.editor} text-sm text-gray-800 resize-none outline-none font-mono ${mode === 'split' ? `border-r ${t.border}` : ''}`}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={'写点什么...\n\n# 标题\n## 小标题\n- 列表项\n1. 编号列表\n- [ ] 待办\n- [x] 已完成'}
            spellCheck={false}
          />
        )}

        {/* 预览区 */}
        {(mode === 'split' || mode === 'preview') && (
          <div className={`${mode === 'split' ? 'flex-1' : 'w-full'} p-4 overflow-y-auto ${t.preview} text-sm text-gray-800`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              allowedElements={['h1', 'h2', 'h3', 'ul', 'ol', 'li', 'p', 'input', 'hr']}
              unwrapDisallowed
              components={checkboxComponents}
            >
              {content || '*预览区*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
