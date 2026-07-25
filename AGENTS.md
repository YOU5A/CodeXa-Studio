<!--
  AGENTS.md — CodeXa Studio
  重构于 2026-07-25
  精简版：面向 AI Agent 的操作指令
-->

# AGENTS.md — CodeXa Studio

**项目:** CodeXa Studio — Windows 系统调优一体化工具箱
**作者:** YOU5A
**技术栈:** TypeScript 6 · React 19 · Tailwind CSS 4 · Framer Motion 12 · Electron 42 · .NET 10
**仓库:** https://github.com/YOU5A/CodeXa-Studio
**版本:** 2.0.0
**许可证:** AGPL-3.0

---

## 核心规则

### 语言与编码

- 对话与注释初始语言为中文。
- 所有文本文件使用 UTF-8 without BOM 编码。
- 修改文件时保持原文件编码，不额外添加 BOM。
- Python 读取文本文件时使用 `encoding='utf-8'` 或 `encoding='utf-8-sig'`。
- 编写包含中文的代码时不要使用 PowerShell。

### Git 规则

- 没有明确 git 指令时不要私自使用 git。
- 可自行调用 Codex 插件和 Skill。

### 文件删除安全规则

- **禁止批量删除文件或目录。**
- 禁止使用: `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 删除文件时只能一次删除一个明确路径的文件: `Remove-Item "C:\path\to\file.txt"`
- 如需批量删除，必须停止操作，让用户手动处理。

---

## 编码行为准则

1. **先思考再编码** — 明确假设，有疑问先问。
2. **简洁优先** — 只写解决问题所需的最少代码，不过度抽象。
3. **精准修改** — 只改需要改的，不顺手"优化"无关代码，匹配现有代码风格。
4. **目标驱动** — 以可验证的成功标准定义任务，循环直到验证通过。

---

## Liquid Glass 设计系统规则

### 迁移原则

- **只修改:** UI、组件、样式、动画。
- **不修改:** 业务逻辑、API、路由、状态管理。
- **所有 UI 必须使用 `src/design-system`**，禁止在页面内创建零散样式。
- **执行流程:** 检查现有代码 → 理解架构 → 解释方案 → 分阶段推进。禁止盲目重写。

### Light DOM 渲染策略

- 全量使用 Light DOM（不使用 Shadow DOM），确保 Electron offscreen 截图可见。
- 禁止 Web Component custom element。
- 使用常规 HTML 元素 + CSS 类名 + data 属性。
- 样式直接通过 CSS 文件引入，不依赖 Shadow DOM 隔离。

---

## 项目结构速览

```
CodeXa-Studio/
├── bridge/                     # Python JSON-RPC 服务端
│   ├── server.py               # RPC 入口（29 个方法路由）
│   └── config.json             # Bridge 语言配置
├── data/                       # 运行时数据（配置、备份索引）
├── electron/                   # Electron 主进程
│   ├── main.js                 # 窗口、IPC、托盘、提权、在线歌词搜索
│   ├── preload.js              # contextBridge → window.electronAPI
│   └── python-bridge.js        # Python 子进程管理器（JSON-RPC over stdin/stdout）
├── resources/                  # Python 核心业务 (.pyw)
│   ├── Win32PrioritySeparation.pyw   # 注册表读写、备份管理
│   ├── AppCpuPriorityTools.pyw       # 进程优先级规则
│   └── File_Music.pyw                # 音乐文件标签/封面操作
├── src/                        # React 前端
│   ├── App.tsx                 # 根组件（路由、布局、Provider 嵌套）
│   ├── main.tsx                # ReactDOM 入口
│   ├── version.ts              # 统一版本号常量
│   ├── components/             # 应用级组件
│   │   ├── FluidBackground/    # Canvas 2D 流体背景子系统
│   │   │   ├── index.tsx       # FluidBackground 组件
│   │   │   ├── renderer.ts     # WebGL/Canvas 渲染器
│   │   │   ├── presets.ts      # 7 套预设定义
│   │   │   └── config.ts       # 配置持久化
│   │   ├── FluidSettingsPanel.tsx  # 流体背景设置面板
│   │   ├── Sidebar.tsx         # 侧边导航栏
│   │   ├── TitleBar.tsx        # 自定义标题栏
│   │   ├── Toast.tsx           # Toast 通知容器
│   │   ├── ConfirmDialog.tsx   # 确认对话框
│   │   ├── GlassCard.tsx       # 应用级 Glass 卡片封装
│   │   └── PageLayout.tsx      # 页面通用布局
│   ├── contexts/               # 4 个 Context
│   │   ├── LanguageContext.tsx       # 中英文切换（同步 Python Bridge）
│   │   ├── MusicPlayerContext.tsx    # HTML5 Audio 播放器状态
│   │   ├── ToastContext.tsx          # 全局 Toast
│   │   └── ConfirmContext.tsx        # 全局确认对话框
│   ├── design-system/          # ★ Liquid Glass 核心（禁止自创样式）
│   │   ├── tokens/             # colors / blur / spacing
│   │   ├── materials/          # 4 级玻璃材质
│   │   ├── components/         # 15 个 Glass 组件
│   │   ├── layouts/            # GlassBackground / GlassLayout / GlassMain
│   │   └── animations/         # springs / glass / 基础变体 + pageTransition
│   ├── hooks/                  # 4 个 Hook
│   │   ├── useTheme.tsx        # 8 套主题切换 + localStorage 持久化
│   │   ├── usePythonBridge.ts  # Python JSON-RPC 调用封装
│   │   ├── useMouseGlow.ts     # 鼠标光晕追踪
│   │   └── useActivityLog.ts   # 操作历史记录
│   ├── lyrics/                 # 歌词子系统
│   │   ├── LyricDisplay.tsx    # 歌词展示容器
│   │   ├── LyricsLine.tsx      # 单行歌词渲染
│   │   ├── LyricWindow.tsx     # 歌词悬浮窗
│   │   ├── LyricManager.ts     # 歌词状态管理
│   │   ├── LyricParser.ts      # LRC 解析器
│   │   ├── InterludeDots.tsx   # 间奏动画
│   │   ├── LyricsSettingsPanel.tsx  # 歌词设置面板
│   │   ├── types.ts            # 歌词类型定义
│   │   └── index.ts            # 统一导出
│   ├── pages/                  # 6 个页面 (React.lazy 懒加载)
│   │   ├── Dashboard.tsx       # 仪表盘
│   │   ├── Win32Priority.tsx   # Win32 优先级分离
│   │   ├── AppCpuPriority.tsx  # 应用 CPU 优先级
│   │   ├── MusicManager.tsx    # 音乐管理器
│   │   ├── BackupCenter.tsx    # 备份中心
│   │   └── Settings.tsx        # 设置
│   ├── styles/globals.css      # Tailwind + CSS 变量主题（8 套）
│   ├── types/index.ts          # 全局类型 + ElectronAPI 声明
│   └── utils/                  # 工具函数
│       ├── animations.ts       # 动画时长/缓动
│       └── colorExtractor.ts   # 专辑封面主色提取
├── public/icon.png             # 应用图标
├── icon.ico                    # Windows 图标
├── package.json                # 依赖 + electron-builder 配置
├── vite.config.ts              # Vite 配置
└── tsconfig.json               # TypeScript 配置
```

### 四层架构

```
React 19 (TypeScript)  ←IPC→  Electron 42  ←JSON-RPC→  .NET 10 (dotnet-bridge/CodeXaBridge.exe)
```

Electron 主进程额外集成 NeteaseCloudMusicApi 实现在线歌词搜索。

### 关键 Context 与 Hook

| 名称 | 类型 | 用途 |
|------|------|------|
| useTheme | Hook | 8 套主题切换 + localStorage 持久化 |
| LanguageContext | Context | 中英文切换，同步到 Python Bridge |
| ToastContext | Context | 全局 Toast (success/warning/error/info) |
| ConfirmContext | Context | 全局确认对话框 |
| MusicPlayerContext | Context | HTML5 Audio 播放器状态 |
| usePythonBridge | Hook | Python JSON-RPC 调用封装 |
| useMouseGlow | Hook | 鼠标光晕追踪 |
| useActivityLog | Hook | 操作历史记录 |

### 流体背景系统

位于 `src/components/FluidBackground/`，Canvas 2D 流体动态背景：
- 7 套预设: aurora / ocean / ember / nebula / plasma / forest / cover
- 支持 auto（主题自适应）和 custom 模式
- 鼠标交互（光晕跟随）、速度/强度/模糊调节
- 配置独立持久化到 localStorage key `fluid-background-config`
- 通过 CustomEvent `fluidSettingsChanged` 跨组件同步

### 歌词子系统

位于 `src/lyrics/`，完整的 LRC 歌词展示方案：
- **LyricParser** — LRC 格式解析（支持多时间标签、偏移量）
- **LyricManager** — 歌词状态管理（当前行、滚动、播放同步）
- **LyricDisplay** — 主展示容器（含动态模糊背景、逐行高亮）
- **LyricsLine** — 单行动画渲染（卡拉 OK 逐字着色）
- **LyricWindow** — 独立悬浮歌词窗口
- **InterludeDots** — 间奏等待动画
- **LyricsSettingsPanel** — 歌词样式调节面板

---

## RPC 方法列表（bridge/server.py）

| 类别 | 方法数 | 方法 |
|------|--------|------|
| 系统信息 | 1 | `system.info` |
| 注册表 | 3 | `registry.read` / `write` / `backup` |
| 管理员 | 2 | `admin.check` / `restart` |
| 优先级规则 | 6 | `priority.list` / `add` / `edit` / `delete` / `export` / `import_config` |
| 音乐管理 | 9 | `music.scan` / `get_metadata` / `save_tags` / `extract_cover` / `apply_cover` / `remove_cover` / `read_cover_file` / `rename` / `get_lyrics` |
| 备份管理 | 6 | `backup.list` / `dir` / `export` / `restore` / `delete` / `clear_all` |
| 配置 | 2 | `config.get` / `set` |

**总计: 29 个 RPC 方法**

---

## 设计令牌速查

| 类别 | 文件 | 核心值 |
|------|------|--------|
| 颜色 | `tokens/colors.ts` | 8 套主题 CSS 变量，4 级 glass 表面色 |
| 模糊 | `tokens/blur.ts` | glass(24px) → surface(16px) → subtle(8px) → none(0px) |
| 间距 | `tokens/spacing.ts` | 4px 基准 · 圆角 sm/md/lg/xl · z-index base→tooltip |
| 材质 | `materials/materials.ts` | ultraThin → regular → thick → elevated |

### Glass 组件清单（15 个）

`GlassSurface` / `GlassCard` / `GlassPanel` / `GlassButton` / `GlassPillButton` / `GlassInput` / `GlassModal` / `GlassSelect` / `GlassToggle` / `GlassProgressBar` / `GlassBadge` / `GlassEmptyState` / `GlassGlow` / `GlassFloat` / `GlassTooltip`

---

## 非项目文件（忽略）

`node_modules/` · `dist/` · `dist-electron/` · `build-support/` · `__pycache__/` · `main.js`（临时）· `*.diff` / `*.patch` · `docs/` · `.env*`

---

## 运行命令

```bash
npm run dev          # 开发模式 (Vite + Electron)
npm run vite:dev     # 仅 Vite
npm run electron:dev # 仅 Electron
npm run build        # 生产构建 (Vite + electron-builder)
```

**环境:** Node.js 22+ · .NET 10 SDK · Windows 11（管理员权限）

**Vite 配置:** 端口 5173 · base: `./` · chunk: react-vendor / motion-vendor / icons-vendor · 别名 `@` → `src/`

**Electron Builder:** 输出 portable + NSIS 安装包 · 请求管理员权限 · 单实例锁

---

## 设计参考

- [liquid-glass-react](https://github.com/rdev/liquid-glass-react)
- [liquid-dom](https://github.com/AndrewPrifer/liquid-dom)
