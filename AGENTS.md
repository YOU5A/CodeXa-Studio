# 通用设置

- 对话语言默认为中文。
- GitHub 仓库: https://github.com/YOU5A/CodeXa-Studio
- 可自行调用 Codex 插件和 Skill。
- 未经明确指令，不得执行任何 git 操作。

# 编码规范

- 所有文本文件使用 UTF-8 without BOM。
- 写入文件时禁止用 `Out-File -Encoding UTF8`（会加 BOM），改用 `[System.IO.File]::WriteAllText` + `UTF8Encoding($false)`。
- Python 读文件统一用 `encoding='utf-8-sig'`。

# PowerShell 限制

- 仅用于文件浏览和简单单文件操作。
- 禁止在 PowerShell 中编写/拼接包含中文的代码，改用 Python。
- 写入 UTF-8 文件参照上方编码规范。

# 文件删除安全规则

- 禁止: `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 只能逐个删除明确路径的文件。需批量删除时停止操作，交用户处理。

# 编码准则

1. **先思考再编码** — 明确假设，有疑问先问。
2. **简洁优先** — 只写解决问题所需的最少代码，不过度抽象。
3. **精准修改** — 只改需要改的，不顺手优化无关代码，匹配现有代码风格。
4. **目标驱动** — 以可验证的成功标准定义任务，循环直到验证通过。

---

--- project-doc ---

<!--
  AGENTS.md — CodeXa Studio
  重构于 2026-08-02
-->

# AGENTS.md — CodeXa Studio

**项目:** CodeXa Studio — Windows 系统调优一体化工具箱（现代化 Windows 音乐管理器 & 系统工具箱）
**作者:** YOU5A / Y0USA
**技术栈:** TypeScript 6 · React 19 · Tailwind CSS 4 · Framer Motion 12 · Electron 42 · .NET 10
**仓库:** https://github.com/YOU5A/CodeXa-Studio
**版本:** 2.2.0
**许可证:** AGPL-3.0

---

## 一、项目架构

### 1.1 项目结构

```
CodeXa-Studio/
├── package.json / package-lock.json     # 依赖 + electron-builder 配置
├── vite.config.ts                       # Vite 8 · 端口 5173 · base: ./ · 别名 @ → src/ · 手动分包
├── tsconfig.json                        # TypeScript 6 · ES2022 · bundler 解析 · strict · 仅含 src
├── tsconfig.electron.json               # Electron 主进程 TS 配置 (commonjs)
├── index.html                           # Vite 入口 HTML
├── start-dev.bat                        # 开发环境一键启动/停止（端口检测 + 进程清理）
├── icon.ico / icon.png                  # 应用图标
├── README.md / LICENSE                  # 说明文档 / AGPL-3.0
├── Screenshot1.png / Screenshot2.png    # 仓库预览图
│
├── electron/                            # Electron 42 主进程
│   ├── main.js                          # 窗口、IPC、托盘、提权、单实例锁、自动启动
│   ├── preload.js                       # contextBridge → window.electronAPI
│   ├── bridge-manager.js                # .NET 主桥启动（开发 publish / 打包 resources）
│   ├── rpc-bridge.js                    # JSON-RPC 子进程管理器（stdin/stdout）
│   ├── ipc-setup.js                     # IPC 处理器 + 在线歌词/封面搜索
│   ├── window.js                        # 无边框透明窗口创建与持久化
│   ├── tray.js                          # 系统托盘（显示/退出）
│   └── rpc/                             # JS 兜底路由分发层（9 模块）
│       ├── index.js                     # callMethod() 34 方法分发
│       ├── system.js                    # system.info
│       ├── registry.js                  # registry.* (3)
│       ├── admin.js                     # admin.* (2)
│       ├── priority.js                  # priority.* (6)
│       ├── music.js                     # music.* (10)
│       ├── ncm.js                       # ncm.* (4)
│       ├── backup.js                    # backup.* (6)
│       └── config.js                    # config.* (2)
│
├── dotnet-bridge/                       # .NET 10 JSON-RPC 主桥接
│   ├── CodeXaBridge.csproj              # net10.0 · TagLibSharp / ImageSharp / PerformanceCounter / System.Management
│   ├── Program.cs                       # JSON-RPC over stdin/stdout · 34 方法分发
│   ├── Services/                        # 8 个服务实现（对应 1.3 方法表）
│   └── publish/ · publish-sc/ · publish2/  # 构建产物（开发 / 自包含发布 / 临时）
│
├── ncm-studio/                          # NCM 解码器（.NET 10 类库 + CLI + 测试）
│   ├── NcmStudio.Core.csproj            # net10.0 类库（TagLibSharp）
│   ├── Crypto/                          # AES-ECB / RC4 / 密钥派生（4 文件）
│   ├── Decoder/                         # NcmDecoder · NcmFileParser · NcmStreamReader
│   ├── Audio/                           # AudioFormatDetector · AudioStreamExtractor · Mp3Writer · FlacWriter
│   ├── Metadata/                        # NcmMetadataParser · CoverArtExtractor · TagWriter
│   ├── Models/                          # AudioFormat · DecryptResult · NcmFileHeader · NcmMetadata
│   ├── Utils/                           # HashVerifier（哈希校验）
│   ├── NcmStudio.Cli/                   # 命令行工具（info / decode / batch / verify）
│   └── NcmStudio.Tests/                 # xUnit 单元测试（密码学/解析器/格式检测）
│
├── diag-cpu/                            # CPU 诊断实验工具（.NET 10 控制台）
│   ├── CpuDiag.csproj                   # PerformanceCounter + System.Management
│   └── Program.cs                       # 性能计数器类别探测与 CPU 时间测试
│
├── demos/                               # 演示页面（demo.html）
├── data/                                # 运行时数据（AppCpuPriority_export.json · config.json · test_cover.txt）
├── docs/                                # 本地分析文档（gitignore 排除，含 legacy-py 旧 Python 工具）
├── public/
│   ├── icon.png
│   └── themes/                          # 5 套特殊主题 CSS（graphite / midnight / ocean / emerald / crimson）
│
└── src/                                 # React 19 前端
    ├── main.tsx                         # ReactDOM 入口
    ├── App.tsx                          # 根组件：路由、布局、Provider 嵌套、NowPlaying 覆盖层
    ├── version.ts                       # 统一版本号 (2.2.0)
    ├── vite-env.d.ts
    ├── types/index.ts                   # SystemInfo · RpcMethod(34) · ElectronAPI · Theme(8) · Page(7)
    ├── constants/                       # storage-keys · default-settings
    ├── styles/globals.css               # Tailwind CSS 4 + 基础样式
    ├── utils/                           # animations · colorExtractor
    │
    ├── design-system/                   # ★ Liquid Glass 核心
    │   ├── tokens/                      # colors · blur · spacing
    │   ├── materials/                   # ultraThin → regular → thick → elevated
    │   ├── components/                  # 19 个 Glass 组件 + index.ts
    │   ├── layouts/                     # GlassBackground · GlassLayout · GlassMain
    │   └── animations/                  # springs · glass · pageTransition
    │
    ├── components/                      # 应用级组件
    │   ├── TitleBar.tsx / Sidebar.tsx / PageLayout.tsx / GlassCard.tsx
    │   ├── BottomNotice.tsx / Toast.tsx / ConfirmDialog.tsx / ErrorBoundary.tsx
    │   ├── CoverSearchPanel.tsx / CoverPreviewWindow.tsx
    │   ├── DevLogPanel.tsx / FluidSettingsPanel.tsx
    │   ├── FluidBackground/             # Canvas 2D + SVG 流体背景（9 预设）
    │   │   ├── config.ts / presets.ts / renderer.ts
    │   │   └── SvgFluidRenderer.tsx / SvgFluidRenderer.css / index.tsx
    │   └── NowPlaying/                  # 全窗口播放覆盖层（10 文件）
    │       ├── NowPlayingOverlay.tsx / NowPlayingBackground.tsx / NowPlayingDisc.tsx
    │       ├── NowPlayingControls.tsx / NowPlayingInfo.tsx / NowPlayingLyrics.tsx
    │       ├── NowPlayingPlaylist.tsx / NowPlayingSettings.ts / NowPlayingSettingsWindow.tsx
    │       └── NowPlaying.css
    │
    ├── contexts/                        # 4 个 Context（见 2.1）
    ├── hooks/                           # 4 个 Hook（见 2.2）
    │
    ├── pages/                           # 7 页面 (React.lazy)
    │   ├── Dashboard.tsx / Win32Priority.tsx / AppCpuPriority.tsx
    │   ├── MusicManager.tsx / NcmStudio.tsx / BackupCenter.tsx / Settings.tsx
    │   ├── music/                       # CoverManager · FileList · PlayerBar · RenamePanel · TagEditor · types
    │   ├── ncm/                         # DecodeBar · FileList · MetadataPanel · types
    │   └── settings/                    # AppearanceSection · BehaviorSection · InterfaceSection · AboutSection · shared
    │
    ├── developer-unlock/                # 开发者解锁系统（7 文件）
    └── lyrics/                          # LRC 歌词子系统（12 文件）
        ├── LyricParser.ts / LyricManager.tsx / LyricDisplay.tsx / LyricBlock.tsx
        ├── LyricWindow.tsx / LyricOverview.tsx / InterludeDots.tsx
        ├── LyricsSettingsPanel.tsx / LyricsSettingsContent.tsx / Scrollbar.tsx
        └── types.ts / index.ts
```

### 1.2 桥接架构（.NET 主桥 + JS 兜底）

```
React 19 ←contextBridge→ Electron 42 ←JSON-RPC→ .NET 10 (主) / JS 路由 (兜底)
                                │
               ┌────────────────┼────────────────┐
               │  electron/rpc/ (路由分发)         │
               │  callMethod() 34 方法              │
               └────────────────┬────────────────┘
                                │
              ▼
    .NET 10 Bridge (主)
    dotnet-bridge/publish(-sc)/CodeXaBridge
    8 个 .cs 服务
```

- **主桥接:** .NET 10 `CodeXaBridge.dll`，JSON-RPC over stdin/stdout，8 个 C# 服务类。开发环境由 bridge-manager 用 `dotnet exec dotnet-bridge/publish/CodeXaBridge.dll` 启动；打包环境从 `resources/dotnet-bridge`（extraResources 复制自 publish-sc）加载。
- **兜底:** electron/rpc/ JS 路由，.NET 桥不可用时直接由 Node 实现同 34 个方法。
- **路由层:** electron/rpc/ 9 个 JS 模块，统一分发 34 个 RPC 方法；rpc-bridge.js 负责子进程生命周期、请求 ID 与缓冲解析。
- **IPC 通道:** preload.js → contextBridge.exposeInMainWorld → `window.electronAPI`，分组为 window / settings / bridge / dialog / shell / music / app。
- **在线搜索:** 歌词与网易云封面走 `NeteaseCloudMusicApi`（cloudsearch + lyric）；QQ 封面（musicu.fcg）、iTunes 封面与图片下载走原生 HTTPS（支持 gzip 解压）。

### 1.3 RPC 方法表（34 个）

| 类别 | 数量 | 方法 | .NET 实现 |
|------|------|------|-----------|
| 系统信息 | 1 | system.info | SystemInfoService.cs |
| 注册表 | 3 | registry.read / write / backup | RegistryService.cs |
| 管理员 | 2 | admin.check / restart | AdminService.cs |
| 优先级 | 6 | priority.list / add / edit / delete / export / import_config | PriorityService.cs |
| 音乐 | 10 | music.scan / get_metadata / save_tags / extract_cover / apply_cover / remove_cover / read_cover_file / save_cover_file / rename / get_lyrics | MusicService.cs |
| NCM | 4 | ncm.list / get_info / decode / batch_decode | NcmService.cs |
| 备份 | 6 | backup.list / dir / export / restore / delete / clear_all | BackupService.cs |
| 配置 | 2 | config.get / set | ConfigService.cs |

---

## 二、前端体系

### 2.1 Context（4 个）

| 名称 | 用途 |
|------|------|
| ConfirmContext | 全局确认对话框 |
| LanguageContext | 中英文切换 · 同步 Bridge |
| MusicPlayerContext | HTML5 Audio 播放器 + 播放列表管理 |
| ToastContext | 全局 Toast (success/warning/error/info) |

### 2.2 Hook（4 个）

| 名称 | 用途 |
|------|------|
| useTheme | 主题读写 · updateSettings · resetSettings · toggleTheme · 8 套主题 + CSS 变量注入 + 主题 CSS 动态加载 |
| useBridge | RPC 调用 · 文件夹/文件对话框 · 文件保存 |
| useMouseGlow | 鼠标光晕追踪 |
| useActivityLog | 活动日志记录与导出 |

### 2.3 页面路由（7 个）

| Page key | 组件 | 功能 |
|----------|------|------|
| dashboard | Dashboard.tsx | 系统概览仪表盘 |
| win32priority | Win32Priority.tsx | Win32 优先级分离 |
| appcpupriority | AppCpuPriority.tsx | 进程 CPU 优先级规则 |
| musicmanager | MusicManager.tsx | 音乐标签/封面/播放 |
| ncmstudio | NcmStudio.tsx | NCM 文件解码/格式转换（需开发者模式） |
| backupcenter | BackupCenter.tsx | 备份浏览/恢复/导出 |
| settings | Settings.tsx | 外观/行为/界面设置 |

页面使用 React.lazy 懒加载（Sidebar 悬停预加载），切换动画由 framer-motion AnimatePresence 驱动，当前页持久化到 localStorage key `codexa-studio-page`。NcmStudio 受开发者模式门禁保护。

### 2.4 关键子系统

#### 流体背景系统

`src/components/FluidBackground/` — Canvas 2D + SVG 双渲染器：
- 9 套预设: aurora（极光）/ ocean（深海）/ ember（余烬）/ nebula（星云）/ plasma（等离子）/ forest（森林）/ cover（封面颜色）/ fluid（流体）/ custom（自定义）
- 支持 auto（主题自适应）与 cover（专辑封面取色）颜色模式
- 速度/强度/模糊/质量 (fps) 可调
- 配置持久化到 localStorage key `fluid-background-config`
- 通过 CustomEvent `fluidSettingsChanged` / `fluidDynamicColorChanged` 跨组件同步

#### 歌词子系统

`src/lyrics/` — 完整 LRC 歌词方案（12 个文件）：
- LyricParser — LRC 解析（多时间标签、偏移量）
- LyricManager — 状态管理（当前行、滚动同步）
- LyricDisplay — 主容器（动态模糊背景、逐行高亮）
- LyricBlock — 卡拉 OK 逐字着色动画
- LyricWindow — 独立悬浮窗口
- LyricOverview — 歌词总览列表（点击跳转、拖拽选择）
- InterludeDots — 间奏等待动画
- LyricsSettingsPanel — 歌词样式设置弹窗
- LyricsSettingsContent — 设置内容（弹窗与 NowPlaying 嵌入面板共用）
- Scrollbar — 可拖拽歌词滚动条（含间奏行映射）
- types / index — 类型与导出

#### NowPlaying 全窗口播放覆盖层

`src/components/NowPlaying/` — Apple Music 风格全窗口播放界面（10 个文件）：
- NowPlayingOverlay — 覆盖层容器与开关
- NowPlayingBackground — 动态背景
- NowPlayingDisc — 旋转唱片
- NowPlayingControls — 播放控制
- NowPlayingInfo — 歌曲信息展示
- NowPlayingLyrics — 覆盖层专属歌词（独立字号/行距/对齐，复用 LyricDisplay）
- NowPlayingPlaylist — 播放列表面板（右侧滑入）
- NowPlayingSettings / NowPlayingSettingsWindow — 覆盖层专属设置（localStorage 持久化）
- NowPlaying.css — 样式

#### NCM 解码子系统

`ncm-studio/` — 独立 .NET 类库，负责网易云音乐 .ncm 文件解码：
- **Crypto:** AES-128-ECB 解密（无填充）、RC4 流密码、密钥派生
- **Decoder:** NCM 文件头解析 → 流解密 → 音频数据提取
- **Audio:** 自动检测原始格式（MP3/FLAC），分别封装输出
- **Metadata:** 内嵌 JSON 元数据解析（标题/艺术家/专辑）+ 封面提取 + ID3v2/FLAC VorbisComment 标签写入
- **Utils:** HashVerifier 哈希校验
- **CLI:** NcmStudio.Cli 提供 info / decode / batch / verify 四个命令
- **测试:** xUnit 单元测试覆盖核心密码学、解析器和格式检测

#### 开发者解锁系统

`src/developer-unlock/` — 内置彩蛋解锁系统：
- DeveloperUnlockService — 解锁逻辑与状态管理
- UnlockGameOverlay — 字母粒子收集游戏覆盖层
- LetterParticle — 粒子动画组件
- UnlockStorage — 解锁状态持久化
- useDevUnlock — React Hook 封装

---

## 三、Liquid Glass 设计系统

### 迁移原则

- **只修改:** UI、组件、样式、动画。
- **不修改:** 业务逻辑、API、路由、状态管理。
- **所有 UI 必须使用 `src/design-system`**，禁止在页面内创建零散样式。
- **执行流程:** 检查现有代码 → 理解架构 → 解释方案 → 分阶段推进。禁止盲目重写。

### Light DOM 渲染策略

- 全量使用 Light DOM（禁用 Shadow DOM），确保 Electron offscreen 截图可见。
- 禁止 Web Component custom element。
- 样式直接通过 CSS 文件引入，不依赖 Shadow DOM 隔离。

### 设计令牌速查

| 类别 | 文件 | 说明 |
|------|------|------|
| 颜色 | tokens/colors.ts | 8 套主题 CSS 变量 + 4 级 glass 表面色 |
| 模糊 | tokens/blur.ts | glass(24px) → surface(16px) → subtle(8px) → none(0px) |
| 间距 | tokens/spacing.ts | 4px 基准 · 圆角 sm/md/lg/xl · 字体 xs~4xl · 图标 · z-index 层级 |
| 材质 | materials/materials.ts | ultraThin → regular → thick → elevated |

主题体系：light / dark / auto + 5 套特殊主题（graphite / midnight / ocean / emerald / crimson），特殊主题 CSS 由 useTheme 从 `public/themes/` 动态注入。

### Glass 组件（19 个）

GlassSurface · GlassCard · GlassPanel · GlassButton · GlassPillButton · GlassInput · GlassModal · GlassSelect · GlassToggle · GlassProgressBar · GlassSeekBar · GlassBadge · GlassEmptyState · GlassGlow · GlassFloat · GlassTooltip · GlassScrollArea · GlassSlider · GlassSVGFilter

布局组件（3 个）：GlassBackground · GlassLayout · GlassMain

---

## 四、运行与部署

### 命令

```bash
npm run dev          # 开发模式 (Vite + Electron)
npm run vite:dev     # 仅 Vite
npm run electron:dev # 仅 Electron
npm run build        # 生产构建 (Vite + electron-builder)
```

另有 `start-dev.bat`：检测 5173 端口是否已在运行；未运行则启动开发环境，已运行则向上查找关联命令行窗口并清理 Vite/Electron 进程。

### 环境

- Node.js 22+
- .NET 10 SDK
- Windows 11（管理员权限）

### 构建配置

- **Vite 8:** 端口 5173（strictPort）· base: ./ · chunk 分包: react-vendor / motion-vendor / icons-vendor · 别名 @ → src/
- **TypeScript 6:** target ES2022 · bundler 解析 · strict 模式 · src 与 electron 两套 tsconfig
- **Electron Builder:** 输出 portable + NSIS 安装包 · 请求管理员权限（requireAdministrator · perMachine · oneClick: false）· 单实例锁 · userData 固定到 `%APPDATA%\CodeXaStudio`
- **打包桥接:** extraResources 将 dotnet-bridge/publish-sc 复制到 `resources/dotnet-bridge` 供主进程加载

---

## 五、非项目文件（忽略）

| 路径 | 来源 |
|------|------|
| node_modules/ | npm 依赖 |
| dist/ | Vite 构建输出 |
| dist-electron/ | electron-builder 输出 |
| build-support/ | 内嵌 Python venv |
| __pycache__/ · *.pyc | Python 缓存 |
| docs/ | 本地分析文档（含 legacy-py 旧 Python 工具） |
| .env* · .vscode/ · .idea/ | 环境变量 / IDE 配置 |
| main.js | 临时编译产物 |
| *.diff · *.patch · temp_patch.txt | 补丁文件 |
| .tmp-* · .tmp-dev-* | 临时文件 |
| data/config.json | 运行时用户配置 |
| AMLL深度分析.md · 流体背景分析.md · 项目结构分析.md | 分析文档（.gitignore） |
| bin/ · obj/ · publish/ · publish2/ | .NET 构建产物（dotnet-bridge / ncm-studio / diag-cpu） |

---

## 六、设计参考

- [liquid-glass-react](https://github.com/rdev/liquid-glass-react)
- [liquid-dom](https://github.com/AndrewPrifer/liquid-dom)
