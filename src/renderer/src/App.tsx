import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const SAVE_DELAY = 500

export default function App() {
  const [content, setContent] = useState('')
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.note.read().then(setContent)
    window.api.window.isAlwaysOnTop().then(setAlwaysOnTop)
  }, [])

  const handleChange = useCallback((val: string) => {
    setContent(val)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      window.api.note.write(val)
    }, SAVE_DELAY)
  }, [])

  const handleToggleTodo = useCallback((index: number) => {
    const lines = content.split('\n')
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
  }, [content, handleChange])

  // content 变化时重建闭包，计数器从 0 开始
  const checkboxComponents = useMemo(() => {
    let index = 0
    return {
      input: ({ checked, disabled: _disabled, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
        const currentIndex = index++
        return (
          <input
            type="checkbox"
            checked={!!checked}
            onChange={() => handleToggleTodo(currentIndex)}
            className="mr-1 cursor-pointer"
            {...props}
          />
        )
      }
    }
  }, [content, handleToggleTodo])

  const toggleAlwaysOnTop = async () => {
    const next = await window.api.window.toggleAlwaysOnTop()
    setAlwaysOnTop(next)
  }

  return (
    <div className="flex flex-col h-screen bg-amber-50 rounded-xl overflow-hidden shadow-2xl">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-amber-100 border-b border-amber-200"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="w-16" />
        <span className="text-xs font-medium text-amber-700 select-none">Desktop Notes</span>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={toggleAlwaysOnTop}
            title={alwaysOnTop ? '取消置顶' : '置顶'}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              alwaysOnTop
                ? 'bg-amber-400 text-amber-900'
                : 'bg-amber-200 text-amber-600 hover:bg-amber-300'
            }`}
          >
            {alwaysOnTop ? '置顶中' : '置顶'}
          </button>
        </div>
      </div>

      {/* 主体：左编辑 + 右预览 */}
      <div className="flex flex-1 overflow-hidden">
        <textarea
          className="flex-1 p-4 bg-amber-50 text-sm text-gray-800 resize-none outline-none font-mono border-r border-amber-200"
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={'用 Markdown 写点什么...\n\n待办事项示例：\n- [ ] 未完成\n- [x] 已完成'}
          spellCheck={false}
        />

        <div className="flex-1 p-4 overflow-y-auto bg-white text-sm text-gray-800">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={checkboxComponents}
          >
            {content || '*预览区*'}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
