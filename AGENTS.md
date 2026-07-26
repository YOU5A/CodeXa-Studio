<!--
  AGENTS.md — CodeXa Studio
  重构于 2026-07-26
  面向 AI Agent 的操作指令
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
├── bridge/                     # Python JSON-RPC 桥接（已废弃，仅 __pycache__）
├── data/                       # 运行时数据（配置、备份索引）
├── diag-cpu/                   # CPU 诊断工具 (.NET)
│   ├── CpuDiag.csproj
│   └── Program.cs
├── dotnet-bridge/              # ★ .NET 10 JSON-RPC 桥接（主桥接）
│   ├── CodeXaBridge.csproj
│   ├── Program.cs              # JSON-RPC over stdin/stdout 入口
│   └── Services/               # 7 个服务实现
│       ├── AdminService.cs     # 管理员检测/提权重启
│       ├── BackupService.cs    # 注册表备份管理
│       ├── ConfigService.cs    # 配置读写
│       ├── MusicService.cs     # 音乐标签/封面/歌词
│       ├── PriorityService.cs  # 进程优先级规则
│       ├── RegistryService.cs  # 注册表读写
│       └── SystemInfoService.cs # 系统信息
├── electron/                   # Electron 主进程
│   ├── main.js                 # 窗口、IPC、托盘、提权、在线歌词搜索
│   ├── preload.js              # contextBridge → window.electronAPI
│   ├── python-bridge.js        # Python 子进程管理器（回退桥接）
│   └── rpc/                    # RPC 路由分发层（8 个模块）
│       ├── index.js            # 路由注册入口
│       ├── admin.js            # admin.check / restart
│       ├── backup.js           # backup.* 方法
│       ├── config.js           # config.get / set
│       ├── music.js            # music.* 方法
│       ├── priority.js         # priority.* 方法
│       ├── registry.js         # registry.* 方法
│       └── system.js           # system.info
├── embed-python/               # 嵌入式 Python 运行时
├── resources/                  # Python 核心业务 (.pyw, 回退用)
│   ├── Win32PrioritySeparation.pyw   # 注册表读写、备份管理
│   ├── AppCpuPriorityTools.pyw       # 进程优先级规则
│   └── File_Music.pyw                # 音乐文件标签/封面操作
├── src/                        # React 前端
│   ├── App.tsx                 # 根组件（路由、布局、Provider 嵌套）
│   ├── main.tsx                # ReactDOM 入口
│   ├── version.ts              # 统一版本号常量 (2.0.0)
│   ├── components/             # 应用级组件
│   │   ├── BottomNotice.tsx    # 底部通知栏
│   │   ├── ConfirmDialog.tsx   # 确认对话框
│   │   ├── CoverSearchPanel.tsx # 封面搜索面板
│   │   ├── FluidSettingsPanel.tsx  # 流体背景设置面板
│   │   ├── GlassCard.tsx       # 应用级 Glass 卡片封装
│   │   ├── PageLayout.tsx      # 页面通用布局
│   │   ├── Sidebar.tsx         # 侧边导航栏
│   │   ├── TitleBar.tsx        # 自定义标题栏
│   │   ├── Toast.tsx           # Toast 通知容器
│   │   └── FluidBackground/    # Canvas/SVG 流体背景子系统
│   │       ├── index.tsx       # FluidBackground 组件
│   │       ├── renderer.ts     # Canvas 2D 渲染器
│   │       ├── presets.ts      # 7 套预设定义
│   │       ├── config.ts       # 配置持久化
│   │       ├── SvgFluidRenderer.tsx  # SVG 流体渲染器
│   │       └── SvgFluidRenderer.css  # SVG 流体样式
│   ├── contexts/               # 4 个 Context
│   │   ├── ConfirmContext.tsx        # 全局确认对话框
│   │   ├── LanguageContext.tsx       # 中英文切换（同步 Bridge）
│   │   ├── MusicPlayerContext.tsx    # HTML5 Audio 播放器状态
│   │   └── ToastContext.tsx          # 全局 Toast
│   ├── design-system/          # ★ Liquid Glass 核心（禁止自创样式）
│   │   ├── index.ts            # 统一导出
│   │   ├── tokens/             # colors / blur / spacing
│   │   │   ├── colors.ts       # 8 套主题 CSS 变量，4 级 glass 表面色
│   │   │   ├── blur.ts         # glass(24px) → surface(16px) → subtle(8px) → none(0px)
│   │   │   ├── spacing.ts      # 4px 基准 · 圆角 · z-index 层级
│   │   │   └── index.ts
│   │   ├── materials/          # 4 级玻璃材质
│   │   │   ├── materials.ts    # ultraThin → regular → thick → elevated
│   │   │   └── index.ts
│   │   ├── components/         # 17 个 Glass 组件
│   │   │   ├── index.ts
│   │   │   ├── GlassSurface.tsx      # 基础玻璃表面
│   │   │   ├── GlassCard.tsx         # 玻璃卡片
│   │   │   ├── GlassPanel.tsx        # 玻璃面板
│   │   │   ├── GlassButton.tsx       # 玻璃按钮
│   │   │   ├── GlassPillButton.tsx   # 胶囊按钮
│   │   │   ├── GlassInput.tsx        # 玻璃输入框
│   │   │   ├── GlassModal.tsx        # 玻璃模态框
│   │   │   ├── GlassSelect.tsx       # 玻璃选择器
│   │   │   ├── GlassToggle.tsx       # 玻璃开关
│   │   │   ├── GlassProgressBar.tsx  # 玻璃进度条
│   │   │   ├── GlassBadge.tsx        # 玻璃徽章
│   │   │   ├── GlassEmptyState.tsx   # 空状态占位
│   │   │   ├── GlassGlow.tsx         # 光晕效果
│   │   │   ├── GlassFloat.tsx        # 浮动容器
│   │   │   ├── GlassTooltip.tsx      # 工具提示
│   │   │   ├── GlassScrollArea.tsx   # 滚动区域
│   │   │   └── GlassSlider.tsx       # 滑块控件
│   │   ├── layouts/            # 布局组件
│   │   │   ├── index.ts
│   │   │   ├── GlassBackground.tsx   # 全局玻璃背景
│   │   │   ├── GlassLayout.tsx       # 页面布局容器
│   │   │   └── GlassMain.tsx         # 主内容区
│   │   └── animations/         # 动画预设
│   │       ├── index.ts
│   │       ├── springs.ts      # Spring 物理参数
│   │       └── glass.ts        # 玻璃材质动画变体 + pageTransition
│   ├── hooks/                  # 4 个 Hook
│   │   ├── useTheme.tsx        # 8 套主题切换 + localStorage 持久化
│   │   ├── usePythonBridge.ts  # Bridge JSON-RPC 调用封装
│   │   ├── useMouseGlow.ts     # 鼠标光晕追踪
│   │   └── useActivityLog.ts   # 操作历史记录
│   ├── lyrics/                 # 歌词子系统
│   │   ├── index.ts            # 统一导出
│   │   ├── types.ts            # 歌词类型定义
│   │   ├── LyricParser.ts      # LRC 格式解析（多时间标签、偏移量）
│   │   ├── LyricManager.tsx    # 歌词状态管理（当前行、滚动、播放同步）
│   │   ├── LyricDisplay.tsx    # 主展示容器（动态模糊背景、逐行高亮）
│   │   ├── LyricBlock.tsx      # 单行动画渲染（卡拉 OK 逐字着色）
│   │   ├── LyricWindow.tsx     # 独立悬浮歌词窗口
│   │   ├── InterludeDots.tsx   # 间奏等待动画
│   │   └── LyricsSettingsPanel.tsx  # 歌词样式调节面板
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
├── tsconfig.json               # TypeScript 配置
├── tsconfig.electron.json      # Electron TypeScript 配置
├── start-dev.bat               # 开发模式启动脚本
└── stop-dev.bat                # 开发模式停止脚本
```

### 桥接架构（双桥回退）

```
React 19 (TypeScript)  ←IPC→  Electron 42  ←JSON-RPC→  .NET 10 (主) / Python (回退)
                                │
                    ┌───────────┴───────────┐
                    │   electron/rpc/        │
                    │   (路由分发层, 8 模块)  │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                                    ▼
    .NET 10 Bridge (主)                  Python Bridge (回退)
    dotnet-bridge/publish/              resources/*.pyw
    CodeXaBridge.exe                    (Win32PrioritySeparation.pyw,
    Services/ (7 个 .cs)                 AppCpuPriorityTools.pyw,
                                        File_Music.pyw)
```

- **主桥接:** .NET 10 `CodeXaBridge.exe`，JSON-RPC over stdin/stdout，7 个服务类。
- **回退桥接:** Python `.pyw` 脚本，当 .NET Bridge 不可用时自动切换。
- **路由层:** `electron/rpc/` 目录 8 个模块，统一分发 29 个 RPC 方法。
- Electron 主进程额外集成 NeteaseCloudMusicApi 实现在线歌词搜索。

### 关键 Context 与 Hook

| 名称 | 类型 | 用途 |
|------|------|------|
| useTheme | Hook | 8 套主题切换 + localStorage 持久化 |
| LanguageContext | Context | 中英文切换，同步到 Bridge |
| ToastContext | Context | 全局 Toast (success/warning/error/info) |
| ConfirmContext | Context | 全局确认对话框 |
| MusicPlayerContext | Context | HTML5 Audio 播放器状态 |
| usePythonBridge | Hook | Bridge JSON-RPC 调用封装 |
| useMouseGlow | Hook | 鼠标光晕追踪 |
| useActivityLog | Hook | 操作历史记录 |

### 流体背景系统

位于 `src/components/FluidBackground/`，Canvas 2D + SVG 流体动态背景：
- 7 套预设: aurora / ocean / ember / nebula / plasma / forest / cover
- 双渲染器: Canvas 2D (`renderer.ts`) + SVG (`SvgFluidRenderer.tsx`)
- 支持 auto（主题自适应）和 custom 模式
- 鼠标交互（光晕跟随）、速度/强度/模糊调节
- 配置独立持久化到 localStorage key `fluid-background-config`
- 通过 CustomEvent `fluidSettingsChanged` 跨组件同步

### 歌词子系统

位于 `src/lyrics/`，完整的 LRC 歌词展示方案：
- **LyricParser** — LRC 格式解析（支持多时间标签、偏移量）
- **LyricManager** — 歌词状态管理（当前行、滚动、播放同步）
- **LyricDisplay** — 主展示容器（含动态模糊背景、逐行高亮）
- **LyricBlock** — 单行动画渲染（卡拉 OK 逐字着色）
- **LyricWindow** — 独立悬浮歌词窗口
- **InterludeDots** — 间奏等待动画
- **LyricsSettingsPanel** — 歌词样式调节面板

---

## RPC 方法列表

**路由分发:** `electron/rpc/` → .NET Bridge (主) 或 Python Bridge (回退)

| 类别 | 方法数 | 方法 | 实现 (C#) |
|------|--------|------|-----------|
| 系统信息 | 1 | `system.info` | SystemInfoService.cs |
| 注册表 | 3 | `registry.read` / `write` / `backup` | RegistryService.cs |
| 管理员 | 2 | `admin.check` / `restart` | AdminService.cs |
| 优先级规则 | 6 | `priority.list` / `add` / `edit` / `delete` / `export` / `import_config` | PriorityService.cs |
| 音乐管理 | 9 | `music.scan` / `get_metadata` / `save_tags` / `extract_cover` / `apply_cover` / `remove_cover` / `read_cover_file` / `rename` / `get_lyrics` | MusicService.cs |
| 备份管理 | 6 | `backup.list` / `dir` / `export` / `restore` / `delete` / `clear_all` | BackupService.cs |
| 配置 | 2 | `config.get` / `set` | ConfigService.cs |

**总计: 29 个 RPC 方法**

---

## 设计令牌速查

| 类别 | 文件 | 核心值 |
|------|------|--------|
| 颜色 | `tokens/colors.ts` | 8 套主题 CSS 变量，4 级 glass 表面色 |
| 模糊 | `tokens/blur.ts` | glass(24px) → surface(16px) → subtle(8px) → none(0px) |
| 间距 | `tokens/spacing.ts` | 4px 基准 · 圆角 sm/md/lg/xl · z-index base→tooltip |
| 材质 | `materials/materials.ts` | ultraThin → regular → thick → elevated |

### Glass 组件清单（17 个）

`GlassSurface` / `GlassCard` / `GlassPanel` / `GlassButton` / `GlassPillButton` / `GlassInput` / `GlassModal` / `GlassSelect` / `GlassToggle` / `GlassProgressBar` / `GlassBadge` / `GlassEmptyState` / `GlassGlow` / `GlassFloat` / `GlassTooltip` / `GlassScrollArea` / `GlassSlider`

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
