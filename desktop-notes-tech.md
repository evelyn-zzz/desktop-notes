# Desktop Notes — 技术方案文档

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron | 主进程管理窗口、菜单栏、文件系统 |
| 前端框架 | React + Vite | 渲染进程 UI |
| 语言 | TypeScript | 主进程和渲染进程均使用 |
| 包管理 | pnpm | |
| Markdown | `react-markdown` + `remark-gfm` | GFM 支持（含 checkbox） |
| 持久化 | electron-store 或直接 `fs` | 本地 JSON / md 文件 |
| 样式 | Tailwind CSS | |

---

## 项目结构

```
desktop-notes/
├── electron/               # 主进程
│   ├── main.ts             # 应用入口，窗口管理
│   └── preload.ts          # 渲染进程与主进程通信桥
├── src/                    # 渲染进程（React）
│   ├── App.tsx
│   ├── components/
│   │   ├── Editor.tsx      # Markdown 编辑器
│   │   ├── Preview.tsx     # Markdown 预览（含 checkbox）
│   │   └── Toolbar.tsx     # 工具栏（模式切换等）
│   └── hooks/
│       └── useNote.ts      # 便签内容读写逻辑
├── package.json
└── vite.config.ts
```

---

## 核心模块设计

### 窗口管理（主进程）

```ts
// electron/main.ts
const win = new BrowserWindow({
  width: 800,
  height: 560,
  alwaysOnTop: true,       // 置顶
  frame: false,            // 无边框，自定义标题栏
  titleBarStyle: 'hidden', // macOS 保留红绿灯按钮
  resizable: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
  },
})
```

- 窗口位置/尺寸通过 `electron-store` 持久化
- 菜单栏图标通过 `Tray` 实现，点击显示/隐藏窗口

### 主进程 ↔ 渲染进程通信（IPC）

```
渲染进程                    主进程
  │── ipcRenderer.invoke('read-note') ──▶ fs.readFile
  │◀─────────────── 返回文件内容 ──────────
  │
  │── ipcRenderer.invoke('write-note', content) ──▶ fs.writeFile
```

通过 `contextBridge` 暴露有限 API，不直接暴露 Node.js 能力。

### Markdown 编辑与 Todo

- 编辑模式：`<textarea>` 直接编辑 Markdown 源文本
- 预览模式：`react-markdown` + `remark-gfm` 渲染
- Checkbox 交互：自定义 `react-markdown` 的 `input` 组件渲染，点击时修改源文本中对应的 `[ ]` / `[x]`

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    input: ({ checked, ...props }) => (
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggleTodo(/* index */)}
        {...props}
      />
    ),
  }}
>
  {content}
</ReactMarkdown>
```

### 本地持久化

- 便签内容保存路径：`userData/notes/note-{id}.md`
- 使用 `electron.app.getPath('userData')` 获取系统标准路径
- 编辑时防抖 500ms 自动保存，无需手动保存操作

---

## 开发流程

```bash
# 安装依赖
pnpm install

# 开发模式（Vite + Electron 同时启动）
pnpm dev

# 打包 macOS .dmg
pnpm build
```

开发时 Vite 负责热更新渲染进程，`electron-reload` 或 `nodemon` 监听主进程变化自动重启。

---

## 关键依赖

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-markdown": "^9",
    "remark-gfm": "^4",
    "electron-store": "^8"
  },
  "devDependencies": {
    "electron": "^31",
    "vite": "^5",
    "electron-builder": "^24",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5",
    "concurrently": "^8",
    "wait-on": "^7"
  }
}
```

---

## 多架构支持与分发 (Apple M5/Silicon)

### 架构选择

应用基于 Electron 构建，支持以下 macOS 架构：

| 架构 | 说明 | 适用设备 |
|------|------|------|
| **arm64** | 原生支持 Apple Silicon | M1, M2, M3, M4, M5 等芯片 |
| **x64** | Intel 架构 | 所有 Intel 芯片的 Mac |
| **universal** | 通用包 | 同时包含 x64 和 arm64，体积约为单架构包的两倍 |

### 构建命令

```bash
# 构建专门针对 Apple 芯片 (M1-M5) 的版本 (推荐)
pnpm exec electron-builder --arm64

# 构建针对 Intel 芯片的版本
pnpm exec electron-builder --x64

# 构建通用版本 (Universal Binary)
pnpm exec electron-builder --universal
```

### 非开发者签名分发方案 (方案 4)

如果你没有 Apple 开发者账号（$99/年），构建时会遇到代码签名报错（如 `The timestamp service is not available`）。

#### 1. 跳过签名构建
在本地构建时，可以使用环境变量跳过签名验证：
```bash
CSC_IDENTITY_AUTODISCOVERY=false pnpm build && pnpm exec electron-builder --arm64
```

#### 2. 其他设备运行权限
未公证的应用从网络下载后会被 macOS 隔离，首次打开时请**点击「完成」（不要点「移到废纸篓」）**，再通过以下方式放行：
1.  **系统设置（适用于 macOS 15+）**：前往「系统设置 -> 隐私与安全性」，在页面底部点击「仍要打开」。
2.  **终端清除隔离属性**：
    ```bash
    xattr -cr /Applications/Desktop\ Notes.app
    ```
    （若安装的是未重新签名的旧包，可补充执行 `codesign --force --deep --sign - /Applications/Desktop\ Notes.app` 修复签名。）
