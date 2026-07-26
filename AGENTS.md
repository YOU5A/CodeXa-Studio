<!--
  AGENTS.md — CodeXa Studio
  重构于 2026-07-26
-->

# AGENTS.md — CodeXa Studio

**项目:** CodeXa Studio — Windows 系统调优一体化工具箱
**作者:** YOU5A / Y0USA
**技术栈:** TypeScript 6 · React 19 · Tailwind CSS 4 · Framer Motion 12 · Electron 42 · .NET 10
**仓库:** https://github.com/YOU5A/CodeXa-Studio
**版本:** 2.0.0
**许可证:** AGPL-3.0

---

## 核心规则

### 语言与编码

- 对话与注释默认中文。
- 所有文本文件 UTF-8 without BOM。
- 修改文件时保持原文件编码，严禁添加 BOM。
- Python 读文件用 `encoding='utf-8'` 或 `encoding='utf-8-sig'`。
- **PowerShell 禁令:** 禁止在 PowerShell 中编写/拼接包含中文的代码；改用 Python。写入 UTF-8 文件用 `[System.IO.File]::WriteAllText` + `UTF8Encoding($false)`。
- 仅用 PowerShell 做文件浏览和简单单文件操作。

### Git 规则

- 无明确 git 指令不得执行任何 git 操作。
- 可自行调用 Codex 插件和 Skill。

### 文件删除安全规则

- **严禁批量删除。** 禁止: `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 只能逐个删除明确路径的文件。需批量删除时停止操作，交用户处理。

---

## 编码行为准则

1. **先思考再编码** — 明确假设，有疑问先问。
2. **简洁优先** — 只写解决问题所需的最少代码，不过度抽象。
3. **精准修改** — 只改需要改的，不顺手"优化"无关代码，匹配现有代码风格。
4. **目标驱动** — 以可验证的成功标准定义任务，循环直到验证通过。

---

## Liquid Glass 设计系统

### 迁移原则

- **只修改:** UI、组件、样式、动画。
- **不修改:** 业务逻辑、API、路由、状态管理。
- **所有 UI 必须使用 `src/design-system`**，禁止在页面内创建零散样式。
- **执行流程:** 检查现有代码 → 理解架构 → 解释方案 → 分阶段推进。禁止盲目重写。

### Light DOM 渲染策略

- 全量使用 Light DOM（禁用 Shadow DOM），确保 Electron offscreen 截图可见。
- 禁止 Web Component custom element。
- 样式直接通过 CSS 文件引入，不依赖 Shadow DOM 隔离。

---

## 项目结构

```
CodeXa-Studio/
├── .gitignore
├── package.json                 # 依赖 + electron-builder 配置
├── vite.config.ts               # Vite 8 · 端口 5173 · base: ./ · 别名 @ → src/
├── tsconfig.json                # TypeScript 6 · ES2022 · bundler 解析
├── tsconfig.electron.json       # Electron 主进程 TS 配置
├── start-dev.bat / stop-dev.bat # 开发模式启停脚本
├── index.html                   # Vite 入口 HTML
│
├── electron/                    # Electron 42 主进程
│   ├── main.js                  # 窗口、IPC、托盘、提权、单实例锁
│   ├── preload.js               # contextBridge → window.electronAPI
│   ├── bridge-manager.js        # 双桥管理器（.NET 优先 → Python 回退）
│   ├── python-bridge.js         # JSON-RPC 子进程管理器（PythonBridge 类）
│   ├── ipc-setup.js             # IPC 处理器 + 在线歌词/封面搜索
│   ├── window.js                # 窗口创建与持久化
│   ├── tray.js                  # 系统托盘
│   └── rpc/                     # RPC 路由分发层（8 模块）
│       ├── index.js             # callMethod() 入口
│       ├── system.js            # system.info
│       ├── registry.js          # registry.* (3)
│       ├── admin.js             # admin.* (2)
│       ├── priority.js          # priority.* (6)
│       ├── music.js             # music.* (10)
│       ├── backup.js            # backup.* (6)
│       └── config.js            # config.* (2)
│
├── dotnet-bridge/               # .NET 10 JSON-RPC 主桥接
│   ├── CodeXaBridge.csproj
│   ├── Program.cs               # JSON-RPC over stdin/stdout · 31 方法分发
│   ├── publish/                 # 开发构建输出
│   ├── publish-sc/              # 自包含发布（生产打包）
│   └── Services/                # 7 个服务实现 (.cs)
│       ├── SystemInfoService.cs     # CPU/内存/磁盘/OS
│       ├── RegistryService.cs       # 注册表读写
│       ├── AdminService.cs          # 管理员检测/提权
│       ├── PriorityService.cs       # 进程优先级规则
│       ├── MusicService.cs          # 音乐标签/封面/歌词 (TagLibSharp)
│       ├── BackupService.cs         # 备份管理
│       └── ConfigService.cs         # 配置读写
│
├── resources/                   # Python 回退脚本
│   ├── Win32PrioritySeparation.pyw
│   ├── AppCpuPriorityTools.pyw
│   └── File_Music.pyw
│
├── diag-cpu/                    # CPU 诊断小工具 (.NET)
├── data/                        # 运行时数据（gitignore 排除）
├── bridge/                      # 旧 Python 桥接（已废弃）
│
└── src/                         # React 19 前端
    ├── main.tsx                  # ReactDOM 入口
    ├── App.tsx                   # 根组件：路由、布局、Provider 嵌套
    ├── version.ts                # 版本号 (2.0.0)
    ├── vite-env.d.ts
    │
    ├── types/
    │   └── index.ts              # 全局类型：SystemInfo · RpcMethod(31) · ElectronAPI
    │
    ├── constants/
    │   ├── storage-keys.ts       # localStorage key 定义
    │   └── default-settings.ts   # 默认设置
    │
    ├── styles/
    │   └── globals.css           # Tailwind CSS 4 + 8 套主题
    │
    ├── design-system/            # ★ Liquid Glass 核心
    │   ├── index.ts
    │   ├── tokens/               # colors · blur · spacing
    │   ├── materials/            # ultraThin → regular → thick → elevated
    │   ├── components/           # 17 个 Glass 组件
    │   ├── layouts/              # GlassBackground · GlassLayout · GlassMain
    │   └── animations/           # springs · glass variants
    │
    ├── components/               # 应用级组件
    │   ├── TitleBar.tsx          # 自定义标题栏
    │   ├── Sidebar.tsx           # 侧边导航 + 预加载
    │   ├── PageLayout.tsx
    │   ├── GlassCard.tsx
    │   ├── BottomNotice.tsx
    │   ├── Toast.tsx
    │   ├── ConfirmDialog.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── CoverSearchPanel.tsx
    │   ├── FluidSettingsPanel.tsx
    │   └── FluidBackground/      # Canvas 2D + SVG 流体背景
    │       ├── index.tsx
    │       ├── renderer.ts
    │       ├── presets.ts        # 7 套预设
    │       ├── config.ts
    │       ├── SvgFluidRenderer.tsx
    │       └── SvgFluidRenderer.css
    │
    ├── contexts/                 # 5 个 Context
    │   ├── LanguageContext.tsx
    │   ├── ToastContext.tsx
    │   ├── ConfirmContext.tsx
    │   └── MusicPlayerContext.tsx
    │
    ├── hooks/                    # 3 个 Hook
    │   ├── useTheme.tsx          # 8 套主题 + CSS 变量注入
    │   ├── useBridge.ts          # Bridge RPC 封装
    │   └── useMouseGlow.ts       # 鼠标光晕
    │
    ├── pages/                    # 6 页面 (React.lazy)
    │   ├── Dashboard.tsx
    │   ├── Win32Priority.tsx
    │   ├── AppCpuPriority.tsx
    │   ├── MusicManager.tsx
    │   ├── BackupCenter.tsx
    │   ├── Settings.tsx
    │   ├── music/                # 音乐子模块
    │   │   ├── FileList.tsx
    │   │   ├── PlayerBar.tsx
    │   │   ├── TagEditor.tsx
    │   │   ├── CoverManager.tsx
    │   │   └── RenamePanel.tsx
    │   └── settings/             # 设置子模块
    │       ├── AppearanceSection.tsx
    │       ├── BehaviorSection.tsx
    │       ├── InterfaceSection.tsx
    │       └── AboutSection.tsx
    │
    ├── lyrics/                   # 歌词子系统
    │   ├── LyricParser.ts
    │   ├── LyricManager.tsx
    │   ├── LyricDisplay.tsx
    │   ├── LyricBlock.tsx
    │   ├── LyricWindow.tsx
    │   ├── InterludeDots.tsx
    │   └── LyricsSettingsPanel.tsx
    │
    └── utils/
        ├── animations.ts
        └── colorExtractor.ts
```

---

## 桥接架构（双桥回退）

```
React 19  ←contextBridge→  Electron 42  ←JSON-RPC→  .NET 10 (主) / Python (回退)
                                │
               ┌────────────────┼────────────────┐
               │  electron/rpc/ (路由分发)         │
               │  callMethod() 31 方法              │
               └────────────────┬────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                                    ▼
    .NET 10 Bridge (主)                  Python Bridge (回退)
    dotnet-bridge/publish-sc/           resources/*.pyw
    CodeXaBridge.exe                    3 个 .pyw 脚本
    7 个 .cs 服务
```

- **主桥接:** .NET 10 `CodeXaBridge.exe`，JSON-RPC over stdin/stdout，7 个 C# 服务类。
- **回退桥接:** Python `.pyw` 脚本，.NET 不可用时自动切换（bridge-manager.js: 3s 延迟 + 最多 3 次重试）。
- **路由层:** `electron/rpc/` 8 个 JS 模块，统一分发 31 个 RPC 方法。
- **IPC 通道:** `electron/preload.js` → `contextBridge.exposeInMainWorld` → `window.electronAPI`。
- **在线搜索:** Electron 主进程集成 NeteaseCloudMusicApi（歌词） + 原生 HTTPS（封面：网易云/QQ/iTunes）。

---

## RPC 方法表（31 个）

| 类别 | 数量 | 方法 | .NET 实现 |
|------|------|------|-----------|
| 系统信息 | 1 | `system.info` | SystemInfoService.cs |
| 注册表 | 3 | `registry.read` / `write` / `backup` | RegistryService.cs |
| 管理员 | 2 | `admin.check` / `restart` | AdminService.cs |
| 优先级 | 6 | `priority.list` / `add` / `edit` / `delete` / `export` / `import_config` | PriorityService.cs |
| 音乐 | 10 | `music.scan` / `get_metadata` / `save_tags` / `extract_cover` / `apply_cover` / `remove_cover` / `read_cover_file` / `save_cover_file` / `rename` / `get_lyrics` | MusicService.cs |
| 备份 | 6 | `backup.list` / `dir` / `export` / `restore` / `delete` / `clear_all` | BackupService.cs |
| 配置 | 2 | `config.get` / `set` | ConfigService.cs |

---

## Context · Hook · 关键组件

### Context（5 个）

| 名称 | 用途 |
|------|------|
| `ThemeProvider` | 8 套主题 + localStorage + CSS 变量注入 + auto 跟随系统 |
| `LanguageContext` | 中英文切换 · 同步 Bridge |
| `ToastContext` | 全局 Toast (success/warning/error/info) |
| `ConfirmContext` | 全局确认对话框 |
| `MusicPlayerContext` | HTML5 Audio 播放器 + 播放列表管理 |

### Hook（3 个）

| 名称 | 用途 |
|------|------|
| `useTheme` | 主题读写 · updateSettings · resetSettings · toggleTheme |
| `useBridge` | RPC 调用 · 文件夹/文件对话框 · 文件保存 |
| `useMouseGlow` | 鼠标光晕追踪 |

### 流体背景系统

`src/components/FluidBackground/` — Canvas 2D + SVG 双渲染器：
- 7 套预设: aurora / ocean / ember / nebula / plasma / forest / cover
- 支持 auto（主题自适应）和 custom（专辑封面取色）模式
- 速度/强度/模糊/质量 (fps) 可调
- 配置持久化到 localStorage key `fluid-background-config`
- 通过 CustomEvent `fluidSettingsChanged` 跨组件同步

### 歌词子系统

`src/lyrics/` — 完整 LRC 歌词方案：
- `LyricParser` — LRC 格式解析（多时间标签、偏移量）
- `LyricManager` — 状态管理（当前行、滚动同步）
- `LyricDisplay` — 主容器（动态模糊背景、逐行高亮）
- `LyricBlock` — 卡拉 OK 逐字着色动画
- `LyricWindow` — 独立悬浮窗口
- `InterludeDots` — 间奏等待动画
- `LyricsSettingsPanel` — 样式调节

---

## 页面路由（6 个）

| Page key | 组件 | 功能 |
|----------|------|------|
| `dashboard` | Dashboard.tsx | 系统概览仪表盘 |
| `win32priority` | Win32Priority.tsx | Win32 优先级分离 |
| `appcpupriority` | AppCpuPriority.tsx | 进程 CPU 优先级规则 |
| `musicmanager` | MusicManager.tsx | 音乐标签/封面/播放 |
| `backupcenter` | BackupCenter.tsx | 备份浏览/恢复/导出 |
| `settings` | Settings.tsx | 外观/行为/界面设置 |

页面使用 `React.lazy` 懒加载，切换动画由 framer-motion `AnimatePresence` 驱动，当前页持久化到 `localStorage` key `codexa-studio-page`。

---

## 设计令牌速查

### 颜色 (`tokens/colors.ts`)
8 套主题 CSS 变量 + 4 级 glass 表面色

### 模糊层级 (`tokens/blur.ts`)
glass(24px) → surface(16px) → subtle(8px) → none(0px)

### 间距 (`tokens/spacing.ts`)
4px 基准 · 圆角 sm/md/lg/xl · 字体 xs~4xl · 图标 · z-index 层级

### 材质 (`materials/materials.ts`)
ultraThin → regular → thick → elevated

### Glass 组件（17 个）
`GlassSurface` · `GlassCard` · `GlassPanel` · `GlassButton` · `GlassPillButton` · `GlassInput` · `GlassModal` · `GlassSelect` · `GlassToggle` · `GlassProgressBar` · `GlassBadge` · `GlassEmptyState` · `GlassGlow` · `GlassFloat` · `GlassTooltip` · `GlassScrollArea` · `GlassSlider`

---

## 运行命令

```bash
npm run dev          # 开发模式 (Vite + Electron)
npm run vite:dev     # 仅 Vite
npm run electron:dev # 仅 Electron
npm run build        # 生产构建 (Vite + electron-builder)
```

**环境:** Node.js 22+ · .NET 10 SDK · Windows 11（管理员权限）

**Vite:** 端口 5173 · base: `./` · chunk 分包: react-vendor / motion-vendor / icons-vendor · 别名 `@` → `src/`

**Electron Builder:** 输出 portable + NSIS 安装包 · 请求管理员权限 · 单实例锁

---

## 非项目文件（忽略）

`node_modules/` · `dist/` · `dist-electron/` · `build-support/` · `__pycache__/` · `*.pyc` · `docs/` · `.env*` · `.vscode/` · `main.js`（临时）· `*.diff` / `*.patch` · `.tmp-dev-*` · `data/config.json` · .NET `bin/` `obj/` `publish/` `publish2/`

---

## 设计参考

- [liquid-glass-react](https://github.com/rdev/liquid-glass-react)
- [liquid-dom](https://github.com/AndrewPrifer/liquid-dom)