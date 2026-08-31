<!--
  AGENTS.md — CodeXa Studio
  根据当前项目结构重建于 2026-08-31
-->

# AGENTS.md — CodeXa Studio

**项目:** CodeXa Studio — Windows 系统调优一体化工具箱与本地音乐管理器
**作者:** Y0USA / YOU5A
**版本:** 2.5.5（`package.json` 与 `src/version.ts` 当前一致）
**仓库:** https://github.com/YOU5A/CodeXa-Studio
**许可证:** AGPL-3.0
**技术栈:** React 19 · TypeScript 6 · Vite 8 · Tailwind CSS 4 · Framer Motion 12 · Electron 42 · .NET 10
**平台:** Windows 11；部分注册表和系统功能需要管理员权限

---

## 一、绝对保护规则

### 通用设置

- 对话语言默认为中文。
- GitHub 仓库: https://github.com/YOU5A/CodeXa-Studio
- 可自行调用 Codex 插件和 Skill。
- 未经明确指令，不得执行任何 git 操作。

### 编码规范

- 所有文本文件使用 UTF-8 without BOM。
- 写入文件时禁止用 `Out-File -Encoding UTF8`（会加 BOM），改用 `[System.IO.File]::WriteAllText` + `UTF8Encoding($false)`。
- Python 读文件统一使用 `encoding='utf-8-sig'`。

### PowerShell 限制

- PowerShell 仅用于文件浏览和简单的单文件操作。
- 禁止在 PowerShell 中编写或拼接包含中文的代码；需要时改用 Python。
- 写入 UTF-8 文件必须遵守上面的无 BOM 约定。

### 文件删除安全规则

- 禁止使用 `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 只能逐个删除明确路径的文件；需要批量删除时停止操作，交由用户处理。

### 编码准则

1. 先思考再编码：明确假设和可验证的成功标准。
2. 简洁优先：只写解决问题所需的最少代码，不过度抽象。
3. 精准修改：只改任务范围内的文件，不顺手优化无关代码。
4. 目标驱动：修改后运行与风险相称的验证，并根据结果继续修正。

---

## 二、项目结构

以下树形结构只列出源码、配置和需要人工维护的资源；`node_modules`、构建产物和 .NET 输出目录见“非项目文件”。

```text
CodeXa-Studio/
├── package.json / package-lock.json       # npm 依赖、脚本和 electron-builder 配置
├── index.html                              # Vite HTML 入口
├── vite.config.ts                          # Vite、Tailwind、路径别名和分包
├── tsconfig.json                           # React/TypeScript 配置，仅包含 src
├── tsconfig.electron.json                  # Electron 端 TypeScript 配置
├── start-dev.bat                           # Windows 开发启动/端口清理脚本
├── icon.ico / icon.png                     # 应用图标
├── README.md / LICENSE                     # 项目说明和 AGPL-3.0 协议
├── Screenshot1.png / Screenshot2.png       # README 预览图
│
├── electron/                               # Electron 主进程和 Node 原生能力
│   ├── main.js                             # 窗口、单实例、提权、托盘和生命周期
│   ├── preload.js                          # contextBridge，暴露 window.electronAPI
│   ├── window.js / tray.js                 # 无边框窗口与系统托盘
│   ├── bridge-manager.js                   # 启动/停止 .NET 桥接进程
│   ├── rpc-bridge.js                       # stdin/stdout JSON-RPC 子进程客户端
│   ├── ipc-setup.js                        # IPC handler、对话框、在线搜索和下载
│   ├── netease-eapi.js                     # 网易云 EAPI 请求
│   ├── romaji.js                           # 日文歌词本地罗马音转换
│   └── rpc/                                # JS 兜底路由
│       ├── index.js                        # callMethod() 分发入口
│       ├── system.js / registry.js         # 系统信息、注册表和 GPU 工具
│       ├── admin.js / priority.js          # 管理员检查、优先级规则
│       ├── music.js / ncm.js               # 音乐文件与 NCM
│       ├── backup.js / config.js           # 备份和配置
│
├── dotnet-bridge/                           # .NET 10 主桥接进程
│   ├── CodeXaBridge.csproj                 # 桥接可执行项目及包引用
│   ├── Program.cs                          # JSON-RPC stdin/stdout 主循环与分发
│   └── Services/                           # 8 个领域服务
│       ├── SystemInfoService.cs
│       ├── RegistryService.cs
│       ├── AdminService.cs
│       ├── PriorityService.cs
│       ├── MusicService.cs
│       ├── NcmService.cs
│       ├── BackupService.cs
│       └── ConfigService.cs
│
├── ncm-studio/                              # 可复用的 NCM 解码核心、CLI 和测试
│   ├── NcmStudio.Core.csproj               # net10.0 类库
│   ├── Crypto/                             # AES-ECB、RC4、密钥派生和流密码
│   ├── Decoder/                            # 文件头、流读取和解码
│   ├── Audio/                              # 格式检测、音频提取、MP3/FLAC 输出
│   ├── Metadata/                           # 元数据、封面和标签写入
│   ├── Models/                             # NCM 头、元数据、格式和结果模型
│   ├── Utils/                              # MD5/SHA256 等哈希校验
│   ├── NcmStudio.Cli/                      # info / decode / batch / verify
│   └── NcmStudio.Tests/                    # xUnit 核心测试
│
├── diag-cpu/                               # PerformanceCounter/WMI CPU 诊断实验程序
├── demos/demo.html                         # 独立演示页面
├── data/                                   # 开发期/运行期数据样例
├── public/icon.png                         # Web 资源图标
├── public/themes/                          # graphite、midnight、ocean、emerald、crimson
└── src/                                    # React 渲染进程
    ├── main.tsx / App.tsx / version.ts     # 入口、根布局、版本号
    ├── types/index.ts                      # 领域模型、Page、Theme、RpcMethod、ElectronAPI
    ├── constants/                          # localStorage key 和默认设置
    ├── styles/globals.css                  # Tailwind 入口和全局样式
    ├── utils/                              # 动画工具和封面取色
    ├── contexts/                           # Confirm、Language、MusicPlayer、Toast
    ├── hooks/                              # useTheme、useBridge、useMouseGlow、useActivityLog
    ├── design-system/                      # Liquid Glass tokens、materials、组件和布局
    ├── components/                         # 应用组件、流体背景和 NowPlaying
    ├── pages/                              # 7 个懒加载页面及 music/ncm/settings 子组件
    ├── lyrics/                             # LRC 解析、同步显示、歌词窗口和设置
    └── developer-unlock/                   # 开发者模式和彩蛋解锁游戏
```

当前没有发现根目录之外的 `AGENTS.md`/`agents.md`；本文件是整个项目的唯一 agent 指南。

---

## 三、运行时架构

```text
React 19 (src)
    │ contextBridge / window.electronAPI
    ▼
Electron 42 (electron)
    ├── 原生 IPC：窗口、对话框、Shell、在线音乐搜索、GPU 工具、NCM
    ├── .NET 10 JSON-RPC 主桥（可用时优先）
    └── electron/rpc/ Node.js 兜底路由
```

### 3.1 Electron 主进程

- `electron/main.js` 固定 Electron `userData` 到 `%APPDATA%\CodeXaStudio`，管理单实例、自动启动、自动提权、窗口生命周期和托盘行为。
- `electron/window.js` 创建无边框窗口并持久化窗口位置、大小、透明度、最大化/全屏状态。
- `electron/preload.js` 通过 `contextBridge` 暴露 `window`、`settings`、`bridge`、`dialog`、`shell`、`music`、`app` 七组 API；渲染进程不得直接使用 Node/Electron API。
- `electron/ipc-setup.js` 注册所有 IPC handler。`bridge:call` 会优先拦截 GPU 相关方法和 `ncm.*`，然后尝试 .NET，失败后转到 JS 路由。
- 在线能力只在主进程执行：网易云歌词/搜索使用 `netease-eapi.js`，QQ 和 iTunes 封面搜索及图片下载在 `ipc-setup.js`，日文歌词罗马音由 `romaji.js` 本地生成。

### 3.2 .NET 桥与 JS 兜底

- `bridge-manager.js` 在开发环境从 `dotnet-bridge/publish/CodeXaBridge.dll` 启动 `dotnet exec`；打包环境从 `resources/dotnet-bridge` 启动。发布目录缺失或进程失败时，应用仍使用 JS 路由。
- `rpc-bridge.js` 负责进程启动、请求 ID、逐行 JSON 解析、错误处理和 `__shutdown__` 退出。
- `dotnet-bridge/Program.cs` 初始化 8 个服务，通过 stdin 接收 JSON、通过 stdout 返回 JSON；服务不应向 stdout 写调试日志。
- `.NET` 分发和 `electron/rpc/index.js` 当前都定义 36 个共享 method：`system` 1、注册表/GPU 检测 5、管理员 2、优先级 6、音乐 10、NCM 4、备份 6、配置 2。
- `src/types/index.ts` 的 `RpcMethod` 另包含 5 个 GPU 备份 method（`gpu.backup.create/list/restore/delete/clear`），因此类型化 API 总计 41 个标识符；这 5 个与 GPU 检测/改名一样由 `electron/rpc/registry.js` 在 IPC 层原生处理。`ncm.*` 也在正常路径中由 `electron/rpc/ncm.js` 直接处理。
- 注册表备份目录和 GPU 备份目录当前分别硬编码为 `C:\CodeXaStudio\backups` 与 `C:\CodeXaStudio\gpu-backups`；修改路径时必须同步前后端行为。

### 3.3 RPC 领域

| 领域 | 主要能力 | 实现位置 |
|---|---|---|
| `system` | CPU、内存、磁盘、Windows 版本、管理员状态 | `SystemInfoService.cs` / `rpc/system.js` |
| `registry` / `gpu` | 注册表值读写与备份、显示适配器检测/改名/GPU 备份 | `RegistryService.cs` / `rpc/registry.js` |
| `admin` | 管理员检查与重启提示 | `AdminService.cs` / `rpc/admin.js` |
| `priority` | IFEO/PerfOptions 规则列表、增改删、导入导出 | `PriorityService.cs` / `rpc/priority.js` |
| `music` | 扫描、元数据/标签、封面、重命名、歌词 | `MusicService.cs` / `rpc/music.js` |
| `ncm` | NCM 列表、信息、单文件/批量解码 | `NcmService.cs` / `rpc/ncm.js` |
| `backup` | 列表、目录、导出、恢复、删除、清空 | `BackupService.cs` / `rpc/backup.js` |
| `config` | 配置读写 | `ConfigService.cs` / `rpc/config.js` |

---

## 四、React 前端

### 4.1 根组件、Provider 与页面

- `src/main.tsx` 在挂载前阻止 Electron 文件拖放的默认行为，然后以 `React.StrictMode` 挂载 `App`。
- `src/App.tsx` 使用 `ThemeProvider → DevUnlockProvider → ToastProvider → ConfirmProvider → LanguageProvider → MusicPlayerProvider`，负责全局布局、页面懒加载、页面切换动画、流体背景、Toast/确认框和 NowPlaying 覆盖层。
- 页面 key 与组件：
  - `dashboard`：系统概览、活动和备份入口（`Dashboard.tsx`）
  - `win32priority`：Win32/注册表优先级规则（`Win32Priority.tsx`）
  - `appcpupriority`：应用 CPU 优先级/IFEO 规则（`AppCpuPriority.tsx`）
  - `musicmanager`：音乐扫描、标签、封面、歌词和播放器（`MusicManager.tsx`）
  - `backupcenter`：GPU 名称检测、修改、恢复和显卡名称备份（`GpuName.tsx`；历史 page key 保留为 `backupcenter`）
  - `ncmstudio`：NCM 解码（`NcmStudio.tsx`，需要开发者模式）
  - `settings`：外观、行为、界面和关于（`Settings.tsx`）
- 页面使用 `React.lazy`。Sidebar 悬停时预加载目标页面；当前页面使用 `codexa-studio-page` 持久化。开发者模式关闭时，NCM 页面会被重定向回仪表盘。

### 4.2 状态、Hook 与数据

- Context：`ConfirmContext`（全局确认）、`LanguageContext`（中英文）、`MusicPlayerContext`（HTML5 Audio、播放列表、音量和播放模式）、`ToastContext`（success/error/warning/info）。
- Hook：`useTheme`（设置、主题解析、特殊主题 CSS 注入并同步 Bridge）、`useBridge`（RPC 和文件对话框）、`useMouseGlow`（鼠标光晕）、`useActivityLog`（活动记录与导出）。
- 主题类型为 `light`、`dark`、`auto`、`graphite`、`midnight`、`ocean`、`emerald`、`crimson`；特殊主题 CSS 位于 `public/themes/`，通过 `useTheme` 动态加载。
- `src/constants/storage-keys.ts` 是 localStorage key 的唯一来源；默认设置位于 `src/constants/default-settings.ts`。不要在业务组件内重复定义 key。
- `src/types/index.ts` 集中定义系统信息、注册表、优先级、音乐元数据、备份、NCM 解码结果、应用设置、页面、主题和 Electron API 类型。

### 4.3 关键前端子系统

#### Liquid Glass 设计系统

`src/design-system/` 是 UI 原语的唯一来源，包含：

- `tokens/`：颜色 CSS 变量、玻璃表面色、模糊层级、4px 间距、圆角、字号、图标尺寸和 z-index。
- `materials/`：`ultraThin`、`regular`、`thick`、`elevated` 材质及其样式转换。
- `animations/`：Framer Motion spring、入场/悬停/按压和页面转场配置。
- `components/`：19 个 Glass 组件，包括 `GlassSurface`、`GlassCard`、`GlassPanel`、`GlassButton`、`GlassInput`、`GlassModal`、`GlassSelect`、`GlassToggle`、`GlassProgressBar`、`GlassSeekBar`、`GlassBadge`、`GlassEmptyState`、`GlassGlow`、`GlassPillButton`、`GlassFloat`、`GlassTooltip`、`GlassSlider`、`GlassScrollArea`、`GlassSVGFilter`。
- `layouts/`：`GlassBackground`、`GlassLayout`、`GlassMain`。

设计约束：

- 所有新增 UI 优先复用 `src/design-system`；页面不得创建与设计系统重复的通用控件或令牌。
- Liquid Glass 重构默认只修改 UI、组件、样式和动画；不得顺带改动业务逻辑、API、路由或状态管理。
- 全项目使用 Light DOM；禁止 Web Component custom element 和 Shadow DOM，以保证 Electron/offscreen 渲染可见。
- 进行视觉重构前先检查现有组件和令牌，分阶段修改并验证，不要盲目重写页面。

#### 流体背景

`src/components/FluidBackground/` 使用 SVG 分块封面、`feTurbulence` 和 `feDisplacementMap` 生成动态流体背景。`FluidSettingsPanel.tsx` 提供 fps（30/60）、模糊、背景类型（`fluid`/`blur`/`gradient`/`solid`）、动态流体和背景暗化设置；NowPlaying 背景与该设置结构共用。暂停播放时支持静态单帧，设置通过 localStorage 和 `fluidSettingsChanged` 事件同步。

#### 歌词系统

`src/lyrics/` 提供统一导出：`LyricParser` 负责 LRC 多时间标签、偏移和纯歌词/动态歌词解析；`LyricManager` 负责当前行和滚动同步；`LyricDisplay`、`LyricBlock`、`LyricOverview`、`Scrollbar`、`InterludeDots` 负责显示、逐字高亮、总览、拖拽和间奏；`LyricWindow` 为独立歌词窗口；`LyricsSettingsPanel` 与 `LyricsSettingsContent` 负责样式设置。

#### NowPlaying 覆盖层

`src/components/NowPlaying/` 实现全窗口 Apple Music 风格播放器：`NowPlayingOverlay` 容器、`NowPlayingBackground` 背景、`NowPlayingDisc` 唱片、`NowPlayingInfo` 信息、`NowPlayingControls` 控制、`NowPlayingLyrics` 歌词、`NowPlayingLyricsCopyMode` 复制模式、`NowPlayingPlaylist` 播放列表、`NowPlayingProgressPreview` 进度悬停预览，以及 `NowPlayingSettings`/`NowPlayingSettingsWindow` 设置和 `NowPlaying.css` 样式。

#### NCM 与开发者解锁

- `ncm-studio/` 是独立 .NET 核心库，支持 NCM 文件头解析、AES-128-ECB 密钥解密、RC4 类流解密、MP3/FLAC 格式识别、音频输出、元数据/封面提取、ID3v2/VorbisComment 标签写入和 MD5/SHA256 校验。CLI 支持 `info`、`decode`、`batch`、`verify`。
- `src/developer-unlock/` 包含 `DeveloperUnlockService`、`UnlockStorage`、`DevUnlockProvider/useDevUnlock`、`UnlockGameOverlay`、`LetterParticle` 和相关类型。它是 NCM 页面门禁与解锁彩蛋的前端实现。

---

## 五、开发、构建与测试

### 环境

- Windows 11
- Node.js 22+
- .NET 10 SDK
- 管理员权限（运行注册表、IFEO、GPU 名称等系统功能时需要）

### npm 脚本

```bash
npm install
npm run dev          # Vite + Electron 开发模式
npm run vite:dev     # 仅启动 Vite（默认 127.0.0.1:5173）
npm run electron:dev # 仅启动 Electron，需先有 Vite 服务
npm run build        # vite build，然后 electron-builder
```

`vite.config.ts` 使用 `base: './'`、端口 `5173`、`strictPort: true`、`@` → `src` 别名，并把 React、Framer Motion、Lucide 图标拆为独立 vendor chunk。当前 `package.json` 没有 lint 或前端测试脚本；不要假设存在 `npm test`。

### .NET 命令

```bash
dotnet build dotnet-bridge/CodeXaBridge.csproj
dotnet build ncm-studio/NcmStudio.Core.csproj
dotnet test ncm-studio/NcmStudio.Tests/NcmStudio.Tests.csproj
dotnet run --project ncm-studio/NcmStudio.Cli -- info <file.ncm>
dotnet run --project ncm-studio/NcmStudio.Cli -- decode <file.ncm> -o <output-dir>
dotnet run --project ncm-studio/NcmStudio.Cli -- batch <directory> -o <output-dir>
dotnet run --project ncm-studio/NcmStudio.Cli -- verify <file>
dotnet run --project diag-cpu/CpuDiag.csproj
```

要让开发环境使用 .NET 主桥，需要先生成 `dotnet-bridge/publish/CodeXaBridge.dll`；否则 Electron 会自动使用 JS 兜底路由。打包时 `electron-builder` 将 `dotnet-bridge/publish-sc` 复制到 resources，并输出 portable 与 NSIS 两种 Windows 包；安装器配置为非一键、可选目录、per-machine、`requireAdministrator`。

---

## 六、配置、数据与安全注意事项

- Electron 窗口设置存于 `%APPDATA%\CodeXaStudio\electron-settings.json`；运行配置由 Bridge/Node 配置路由管理，开发期可能回落到项目 `data/config.json`。
- `data/config.json` 是运行时用户配置，已被 `.gitignore` 排除；`data/AppCpuPriority_export.json` 和 `data/test_cover.txt` 是仓库中的样例/测试数据。
- 注册表、IFEO/PerfOptions、GPU 显示名称和备份恢复都会改变 Windows 系统状态。改动相关代码时必须保留管理员检查、错误返回和备份提示。
- 音乐文件会被直接扫描、写标签、写入/删除封面或重命名；在线接口只获取歌词/封面等公开信息，不应加入音乐上传或下载逻辑。
- 修改 IPC API 时须同时更新 `electron/preload.js`、`src/types/index.ts`、调用方和对应 .NET/JS 实现，避免类型声明与运行时分发不一致。

---

## 七、非项目文件与忽略项

这些路径来自根目录 `.gitignore`，不要将其当作源码分析或提交内容：

| 路径 | 来源/用途 |
|---|---|
| `node_modules/` | npm 依赖 |
| `dist/`、`dist-electron/` | Vite 和 electron-builder 构建输出 |
| `build-support/` | 内嵌 Python 运行环境 |
| `bin/`、`obj/`、`publish/`、`publish2/` | .NET 编译/发布输出；`dotnet-bridge/publish-sc/` 同属发布产物 |
| `__pycache__/`、`*.pyc`、`*.pyo`、`*.pyd` | Python 缓存/二进制 |
| `docs/` | 本地分析文档 |
| `main.js`、`*.diff`、`*.patch`、`.patch1.diff`、`temp_patch.txt` | 临时编译/补丁文件 |
| `.tmp-*`、`.tmp-dev-*` | 开发临时目录和文件 |
| `.env*`、`.vscode/`、`.idea/`、编辑器交换文件 | 本地环境和 IDE 配置 |
| `.DS_Store`、`Thumbs.db`、`Desktop.ini` | 操作系统元数据 |
| `data/config.json` | 运行时用户配置 |
| `AMLL深度分析.md`、`流体背景分析.md`、`项目结构分析.md` | 本地分析文档 |

---

## 八、设计参考

- [liquid-glass-react](https://github.com/rdev/liquid-glass-react)
- [liquid-dom](https://github.com/AndrewPrifer/liquid-dom)
- [amll-dev/applemusic-like-lyrics](https://github.com/amll-dev/applemusic-like-lyrics)
- [SUlTlUS/refined-now-playing-netease-next](https://github.com/SUlTlUS/refined-now-playing-netease-next)
