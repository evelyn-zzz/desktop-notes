# Desktop Notes

一款轻量、极简的 macOS 桌面置顶 Markdown 便签应用，基于 Electron + React + TypeScript + Tailwind CSS 构建。

## 核心特性

- **桌面置顶浮窗**：无边框极简标题栏，支持一键置顶切换、窗口拖拽与尺寸/位置记忆、菜单栏托盘快速显示/隐藏。
- **三种显示模式**：支持 **分屏**（左编辑 + 右预览）、**纯编辑**、**纯预览** 切换（标题栏按钮或顶部菜单栏 `View -> 显示模式`）。
- **受限 Markdown 与交互式 Todo**：支持标题（`#` / `##` / `###`）、无序/有序列表、分割线以及 `- [ ]` / `- [x]` 待办勾选，预览区点击复选框自动同步更新源文本。
- **预览模式文本复制**：预览区支持鼠标划选并 `Cmd+C` 或右键「复制 / 全选」，纯预览模式下标题栏提供一键「复制」全部内容按钮。
- **四套预设主题**：暖黄、冷灰、薄荷绿、天蓝，主题选择持久化保存。
- **本地自动保存与同步**：内容自动防抖保存至本地 `note.md`，并监听外部文件变更实时同步。
- **应用内检查更新**：支持从 GitHub Releases 检查新版本，并在 macOS 上自动下载、解压、替换应用并重启（保留全部本地笔记与配置）。

## 下载与安装（macOS）

1. 前往 [GitHub Releases](https://github.com/evelyn-zzz/desktop-notes/releases) 下载对应芯片架构的 `.dmg` 安装包（勿下载源码压缩包）：
   - Apple Silicon（M1–M5）：`Desktop-Notes-*-arm64.dmg`
   - Intel Mac：`Desktop-Notes-*-x64.dmg`
   - （`*.zip` 为应用内自动更新使用的资源包，手动安装下载 `.dmg` 即可）
2. 打开 `.dmg`，将 `Desktop Notes.app` 拖入「应用程序」文件夹。
3. **首次启动授权**：由于安装包未使用 Apple 开发者证书公证（已内置 ad-hoc 签名），首次打开若提示无法验证恶意软件，请**点击「完成」（不要点「移到废纸篓」）**，然后任选以下方式放行：
   - **系统设置放行（推荐，适用于 macOS 15+）**：打开「系统设置 -> 隐私与安全性」，滑到底部找到 `Desktop Notes` 点击 **「仍要打开」**。
   - **终端清除隔离属性**：
     ```bash
     xattr -cr /Applications/Desktop\ Notes.app
     ```

## 检查更新

- **自动提示**：应用启动后会在后台检查 GitHub Releases 最新版本；若有新版，标题栏右侧会显示 `更新 vX.Y.Z` 提示按钮，点击即可自动下载安装并重启。
- **手动检查**：点击顶部菜单栏 `Desktop Notes -> 检查更新...`。
- **数据安全**：笔记内容与窗口配置保存在系统 `userData` 目录，更新覆盖应用不会丢失数据：
  - 笔记文件：`~/Library/Application Support/Desktop Notes/note.md`
  - 应用配置：`~/Library/Application Support/Desktop Notes/config.json`

## 本地开发

环境要求：Node.js 20+（推荐 22）、pnpm 10+。

```bash
# 安装依赖
pnpm install

# 启动开发环境（Vite 热更新 + Electron）
pnpm dev

# 构建主进程、Preload 与渲染进程产物
pnpm build
```

## 打包与发布

### 本地打包（跳过 Apple 签名）

```bash
# Apple Silicon (arm64)
CSC_IDENTITY_AUTODISCOVERY=false pnpm build && pnpm exec electron-builder --mac --arm64

# Intel (x64)
CSC_IDENTITY_AUTODISCOVERY=false pnpm build && pnpm exec electron-builder --mac --x64

# 同时打包 arm64 与 x64（生成 .dmg 和用于应用内更新的 .zip）
CSC_IDENTITY_AUTODISCOVERY=false pnpm build && pnpm exec electron-builder --mac --arm64 --x64
```

### GitHub Actions 自动发布

仓库已配置 [release.yml](.github/workflows/release.yml) 与 [CHANGELOG.md](CHANGELOG.md)。发版前请先完成以下两步：

1. 在 [CHANGELOG.md](CHANGELOG.md) 中新增对应版本章节（如 `## [0.2.0] - YYYY-MM-DD`），工作流会自动提取该章节作为 Release 正文及应用内更新弹窗内容。
2. 同步更新 [package.json](package.json) 中的 `version`（需与 tag 去掉 `v` 后一致）。

然后提交并推送 `v*` 标签，GitHub 会自动构建 `arm64` / `x64` 安装包并发布 Release：

```bash
git tag v0.2.0
git push origin master --tags
```

完整历史变更见 [CHANGELOG.md](CHANGELOG.md)。

## 技术栈

- **桌面端**：Electron 31 + electron-vite + electron-builder + electron-store
- **前端**：React 18 + TypeScript + Tailwind CSS + react-markdown + remark-gfm

## License

[MIT](LICENSE)
