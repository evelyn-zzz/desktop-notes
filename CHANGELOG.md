# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.0] - 2026-11-26

### 新增
- **预览模式复制文本**：预览区支持鼠标划选与 `Cmd+C` 复制；编辑器与预览区新增原生右键菜单（复制、全选、剪切、粘贴）；纯预览模式标题栏新增一键「复制」按钮。
- **应用内检查更新**：接入 GitHub Releases 检查更新（菜单栏 `Desktop Notes -> 检查更新...` 与启动后静默检查），支持应用内下载 `.zip` 更新包、校验并自动替换重启（保留本地笔记与配置）。
- **自动化发布与开源规范**：新增 GitHub Actions 自动打包发布 `arm64` / `x64` 安装包工作流，补充 `README.md`、`CHANGELOG.md` 与 `MIT` 协议。

### 优化
- **安装包命名规范**：统一构建产物为 `Desktop-Notes-<version>-<arch>.dmg` 与 `Desktop-Notes-<version>-<arch>.zip`，消除文件名空格并明确区分 `arm64` 与 `x64`。

### 修复
- 修复 `electron-builder` 在 tag 构建时默认尝试使用未配置的 `GH_TOKEN` 自动发布导致 GitHub Actions 失败的问题。
- 修复跳过签名打包后未执行 ad-hoc 重签导致 macOS 提示签名损坏/阻止运行的问题（新增 `afterPack` 自动执行 `codesign` 与严格校验）。

## [0.1.0] - 2026-05-09

### 新增
- **桌面悬浮便签**：支持窗口置顶切换、无边框极简标题栏拖拽、窗口尺寸/位置持久化以及菜单栏托盘显隐控制。
- **多模式与主题**：支持分屏 / 纯编辑 / 纯预览三种显示模式切换，以及暖黄、冷灰、薄荷绿、天蓝四套预设主题。
- **Markdown 与 Todo**：支持标题（`#` / `##` / `###`）、无序/有序列表、分割线与可点击切换的 Todo 复选框（`- [ ]` / `- [x]`）。
- **本地存储与同步**：支持 `note.md` 500ms 防抖自动保存与外部文件变更实时同步，支持无签名多架构构建与 macOS 应用图标。

[Unreleased]: https://github.com/evelyn-zzz/desktop-notes/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/evelyn-zzz/desktop-notes/releases/tag/v0.2.0
[0.1.0]: https://github.com/evelyn-zzz/desktop-notes/releases/tag/v0.1.0
