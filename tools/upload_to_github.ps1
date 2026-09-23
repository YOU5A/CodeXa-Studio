$ErrorActionPreference = 'Continue'
if (Test-Path variable:global:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}

try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch {}

function U([string]$Value) {
    return [System.Text.RegularExpressions.Regex]::Unescape($Value)
}

$T = @{
    Subtitle         = '\u7ec8\u7aef\u4ea4\u4e92\u4e0e\u72b6\u6001\u770b\u677f'
    Start            = '\u6b63\u5728\u542f\u52a8\u4e0a\u4f20\u7ec8\u7aef...'
    RepoError        = '\u9519\u8bef\uff1a\u5f53\u524d\u8def\u5f84\u4e0d\u662f Git \u4ed3\u5e93\u3002'
    GitError         = '\u9519\u8bef\uff1a\u627e\u4e0d\u5230 Git\uff0c\u6216 Git \u64cd\u4f5c\u5931\u8d25\u3002'
    OriginError      = '\u9519\u8bef\uff1a\u672a\u914d\u7f6e origin \u8fdc\u7a0b\u4ed3\u5e93\u3002'
    BranchError      = '\u9519\u8bef\uff1a\u65e0\u6cd5\u83b7\u53d6\u5f53\u524d\u5206\u652f\u3002'
    BranchLabel      = '\u5f53\u524d\u5206\u652f'
    HeadCommit       = '\u5df2\u63d0\u4ea4 (HEAD)'
    RemoteTarget     = '\u8fdc\u7a0b\u76ee\u6807'
    SyncStatus       = '\u540c\u6b65\u72b6\u6001'
    SyncSynced       = '\u5df2\u4e0e\u8fdc\u7a0b\u540c\u6b65'
    SyncAhead        = '\u672c\u5730\u9886\u5148 {0} \u4e2a\u63d0\u4ea4\uff08\u5f85\u63a8\u9001\uff09'
    SyncBehind       = '\u843d\u540e\u8fdc\u7a0b {0} \u4e2a\u63d0\u4ea4\uff08\u9700\u62c9\u53d6\uff09'
    SyncDiverged     = '\u5206\u652f\u5206\u53c9\uff08\u9886\u5148 {0}\uff0c\u843d\u540e {1}\uff09'
    SyncNoUpstream   = '\u672a\u5173\u8054\u8fdc\u7a0b\u8ddf\u8e2a\u5206\u652f\uff08\u9996\u6b21\u63a8\u9001\uff09'
    Staged           = '\u5f85\u63d0\u4ea4 (Index)'
    Unstaged         = '\u672a\u6682\u5b58 (Worktree)'
    Untracked        = '\u672a\u8ddf\u8e2a (Untracked)'
    CleanRepo        = '\u5de5\u4f5c\u533a\u5e72\u51c0\uff0c\u6240\u6709\u4fee\u6539\u5747\u5df2\u63d0\u4ea4\u3002'
    Step1            = '\u7b2c 1/4 \u6b65: \u5206\u6790\u4ed3\u5e93\u4e0e\u5de5\u4f5c\u533a\u72b6\u6001'
    Step2            = '\u7b2c 2/4 \u6b65: \u6682\u5b58\u5de5\u4f5c\u533a\u53d8\u66f4'
    Step3            = '\u7b2c 3/4 \u6b65: \u521b\u5efa\u672c\u5730\u7248\u672c\u63d0\u4ea4'
    Step4            = '\u7b2c 4/4 \u6b65: \u63a8\u9001\u53d8\u66f4\u81f3 GitHub'
    StepPushOnly     = '\u63a8\u9001\u672c\u5730\u63d0\u4ea4\u81f3 GitHub'
    CommitInput      = '\u8f93\u5165\u63d0\u4ea4\u8bf4\u660e'
    InputHint        = '\u7559\u7a7a\u4f7f\u7528\u9ed8\u8ba4\u63d0\u4ea4\u8bf4\u660e'
    DefaultCommit    = '\u901a\u8fc7\u4e0a\u4f20\u7ec8\u7aef\u63d0\u4ea4\u53d8\u66f4'
    ConfirmPublish   = '\u786e\u8ba4\u6682\u5b58\u5e76\u63a8\u9001\u5230 GitHub\uff1f'
    ConfirmPushAhead = '\u68c0\u6d4b\u5230\u672a\u63a8\u9001\u63d0\u4ea4\uff0c\u786e\u8ba4\u63a8\u9001\u81f3 GitHub\uff1f'
    ConfirmHint      = '\u56de\u8f66\u6216\u8f93\u5165 Y \u786e\u8ba4\uff0c\u8f93\u5165 N \u53d6\u6d88'
    Cancelled        = '\u5df2\u53d6\u6d88\uff0c\u672a\u6267\u884c\u63d0\u4ea4\u6216\u63a8\u9001\u3002'
    Complete         = '\u4e0a\u4f20\u5b8c\u6210\uff0c\u4ee3\u7801\u5df2\u6210\u529f\u540c\u6b65\u81f3 GitHub\u3002'
    Incomplete       = '\u64cd\u4f5c\u672a\u5b8c\u6210\uff0c\u8bf7\u67e5\u770b\u4e0a\u65b9\u8f93\u51fa\u3002'
    AlreadyClean     = '\u5de5\u4f5c\u533a\u5e72\u51c0\u4e14\u5df2\u4e0e\u8fdc\u7a0b\u540c\u6b65\uff0c\u65e0\u9700\u63a8\u9001\u3002'
    NoChanges        = '\u6682\u5b58\u540e\u65e0\u5b9e\u9645\u53d8\u66f4\u3002'
    AlreadyRunning   = '\u4e0a\u4f20\u7ec8\u7aef\u5df2\u5728\u8fd0\u884c\uff0c\u8bf7\u4f7f\u7528\u5df2\u6253\u5f00\u7684\u7a97\u53e3\u3002'
    ExitHint         = '\u6309 Enter \u952e\u5173\u95ed\u7ec8\u7aef'
    Pushing          = '\u6b63\u5728\u4e0e GitHub \u5efa\u7acb\u8fde\u63a5\u5e76\u63a8\u9001...'
    CountingObjects  = '\u6b63\u5728\u7edf\u8ba1\u5bf9\u8c61'
    CompressingData  = '\u6b63\u5728\u538b\u7f29\u6570\u636e'
    WritingObjects   = '\u6b63\u5728\u4e0a\u4f20\u6570\u636e'
    ResolvingDeltas  = '\u8fdc\u7a0b\u6b63\u5728\u5904\u7406'
    BehindWarning    = '\u8b66\u544a\uff1a\u672c\u5730\u843d\u540e\u8fdc\u7a0b {0} \u4e2a\u63d0\u4ea4\uff0c\u63a8\u9001\u53ef\u80fd\u88ab\u62d2\u7edd\uff01\u5efa\u8bae\u5148\u6267\u884c git pull --rebase'
    ErrRejected      = '\u63a8\u9001\u88ab\u8fdc\u7a0b\u62d2\u7edd (Non-fast-forward)\uff1a\u8fdc\u7a0b\u5305\u542b\u672c\u5730\u7f3a\u5c11\u7684\u65b0\u63d0\u4ea4\u3002'
    ErrRejectedTip   = '\u89e3\u51b3\u65b9\u6cd5\uff1a\u8bf7\u5148\u6267\u884c git pull --rebase \u540c\u6b65\u8fdc\u7a0b\u540e\u91cd\u8bd5\u3002'
    ErrAuth          = '\u8eab\u4efd\u8ba4\u8bc1\u5931\u8d25\uff1aGitHub \u8bbf\u95ee\u6743\u9650\u4e0d\u8db3\u6216\u51ed\u636e\u5931\u6548\u3002'
    ErrAuthTip       = '\u89e3\u51b3\u65b9\u6cd5\uff1a\u8bf7\u68c0\u67e5 Git Credential Manager\u3001SSH Key \u6216 Personal Access Token\u3002'
    ErrNet           = '\u7f51\u7edc\u8fde\u63a5\u5931\u8d25\uff1a\u65e0\u6cd5\u8fde\u63a5\u81f3 GitHub \u670d\u52a1\u5668\u3002'
    ErrNetTip        = '\u89e3\u51b3\u65b9\u6cd5\uff1a\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u3001DNS \u6216\u7cfb\u7edf\u4ee3\u7406\u914d\u7f6e\u3002'
    OpPleaseWait     = '\u540e\u53f0\u5904\u7406\u4e2d\uff0c\u8bf7\u52ff\u5173\u95ed\u7ec8\u7aef'
    OpLocked         = '\u6267\u884c\u4e2d...'
    ReloadHint       = '\u6309 Enter \u952e\u91cd\u65b0\u52a0\u8f7d\u811a\u672c\uff08\u6216\u8f93\u5165 Q \u9000\u51fa\uff09'
    ReloadLabel      = '[Enter: \u91cd\u65b0\u52a0\u8f7d / Q: \u9000\u51fa] > '
}
foreach ($Key in @($T.Keys)) { $T[$Key] = U $T[$Key] }

$Glyph = @{
    TL    = [char]0x256D
    TR    = [char]0x256E
    BL    = [char]0x2570
    BR    = [char]0x256F
    ML    = [char]0x251C
    MR    = [char]0x2524
    H     = [char]0x2500
    V     = [char]0x2502
    Dot   = [char]0x25CF
    Check = [char]0x2714
    Cross = [char]0x2718
}

function Set-Cursor([int]$x, [int]$y) {
    try {
        $Host.UI.RawUI.CursorPosition = [System.Management.Automation.Host.Coordinates]::new($x, $y)
    } catch {}
}

function Write-At([int]$x, [int]$y, [string]$text, [ConsoleColor]$color = [ConsoleColor]::Gray, [bool]$clearToEnd = $true) {
    try {
        $Host.UI.RawUI.CursorPosition = [System.Management.Automation.Host.Coordinates]::new($x, $y)
        $maxW = 76
        try {
            if ($Host.UI.RawUI.WindowSize.Width -gt 6) {
                $maxW = $Host.UI.RawUI.WindowSize.Width - $x - 1
            }
        } catch {}
        $lineText = if ($clearToEnd) { $text.PadRight($maxW) } else { $text }
        if ($lineText.Length -gt $maxW) { $lineText = $lineText.Substring(0, $maxW) }
        Write-Host -NoNewline $lineText -ForegroundColor $color
    } catch {}
}

function Format-Arguments([string[]]$ArgsList) {
    $formatted = foreach ($arg in $ArgsList) {
        if ($arg -match '[\s"]') {
            '"{0}"' -f ($arg -replace '(\\*)(")', '$1$1\"' -replace '(\\+)$', '$1$1')
        } else {
            $arg
        }
    }
    return $formatted -join ' '
}

function Write-Header {
    Clear-Host
    try { $Host.UI.RawUI.WindowTitle = 'CodeXa Studio | GitHub Publisher' } catch {}

    $Rule = [string]::new($Glyph.H, 72)
    Write-Host ''
    Write-Host '  ' -NoNewline
    Write-Host $Glyph.Dot -ForegroundColor Red -NoNewline
    Write-Host ' ' -NoNewline
    Write-Host $Glyph.Dot -ForegroundColor Yellow -NoNewline
    Write-Host ' ' -NoNewline
    Write-Host $Glyph.Dot -ForegroundColor Green -NoNewline
    Write-Host '  CODEXA STUDIO' -ForegroundColor White -NoNewline
    Write-Host '  /  GitHub Publisher' -ForegroundColor Gray
    Write-Host ('  ' + $Rule) -ForegroundColor DarkGray
    Write-Host ('  ' + $T.Subtitle) -ForegroundColor Gray
    Write-Host ''
}

function Init-ScreenLayout([int]$CardBottomRow) {
    $winH = 30
    try {
        if ($Host.UI.RawUI.WindowSize.Height -gt 0) {
            $winH = $Host.UI.RawUI.WindowSize.Height
        }
    } catch {}
    if ($winH -lt 24) { $winH = 24 }

    # 输入框锁定在最底部（底边线、提示行、标题行、顶边线）
    $script:InputBottomRow = [Math]::Max($CardBottomRow + 6, $winH - 2)
    $script:InputPromptRow = $script:InputBottomRow - 1
    $script:InputTitleRow  = $script:InputBottomRow - 2
    $script:InputTopRow    = $script:InputBottomRow - 3

    # 进度条放置在输入框上面（固定单行）
    $script:ProgressRow    = $script:InputTopRow - 2
}

function Show-DynamicProgress {
    param(
        [int]$Percent,
        [string]$StepText,
        [string]$DetailText = '',
        [int]$BarWidth = 26
    )

    $Percent = [Math]::Max(0, [Math]::Min(100, $Percent))
    $filled = [int][Math]::Round(($Percent / 100.0) * $BarWidth)
    $empty = $BarWidth - $filled
    $fullBlock = [char]0x2588
    $emptyBlock = [char]0x2591
    $filledStr = [string]::new($fullBlock, $filled)
    $emptyStr = [string]::new($emptyBlock, $empty)

    $detail = if ($DetailText) { " · $DetailText" } else { "" }
    $prefix = if ($Percent -eq 100) { "  " + $Glyph.Check + " " } else { "    " }
    $line = "$prefix[$filledStr$emptyStr] $(" {0,3}% " -f $Percent) $StepText$detail"

    # 仅更新这一排固定进度条行
    Write-At 0 $script:ProgressRow $line White $true
}

function Render-InputBox {
    param(
        [string]$Title,
        [string]$Hint = '',
        [string]$PromptLabel = '> ',
        [ConsoleColor]$LabelColor = [ConsoleColor]::Cyan
    )

    $ruleWidth = 72
    try {
        if ($Host.UI.RawUI.WindowSize.Width -gt 6) {
            $ruleWidth = [Math]::Min(72, [Math]::Max(40, $Host.UI.RawUI.WindowSize.Width - 6))
        }
    } catch {}
    $rule = "  " + [string]::new($Glyph.H, $ruleWidth)

    Write-At 0 $script:InputTopRow $rule DarkGray $true

    $hintText = if ($Hint) { " · $Hint" } else { "" }
    $titleText = "  $Title$hintText"
    Write-At 0 $script:InputTitleRow $titleText White $true

    $promptText = "  │ $PromptLabel"
    Write-At 0 $script:InputPromptRow $promptText $LabelColor $true

    Write-At 0 $script:InputBottomRow $rule DarkGray $true
}

function Read-BottomInput {
    param(
        [string]$Title,
        [string]$Hint = '',
        [string]$DefaultValue = '',
        [string]$PromptLabel = '> ',
        [ConsoleColor]$LabelColor = [ConsoleColor]::Cyan
    )

    Render-InputBox -Title $Title -Hint $Hint -PromptLabel $PromptLabel -LabelColor $LabelColor
    Set-Cursor 0 $script:InputPromptRow
    $promptStr = "  │ $PromptLabel"
    $inputVal = Read-Host -Prompt $promptStr

    $ruleWidth = 72
    try {
        if ($Host.UI.RawUI.WindowSize.Width -gt 6) {
            $ruleWidth = [Math]::Min(72, [Math]::Max(40, $Host.UI.RawUI.WindowSize.Width - 6))
        }
    } catch {}
    $rule = "  " + [string]::new($Glyph.H, $ruleWidth)
    Write-At 0 $script:InputBottomRow $rule DarkGray $true

    if ([string]::IsNullOrWhiteSpace($inputVal)) {
        return $DefaultValue
    }
    return $inputVal
}

function Invoke-GitDirect {
    param([string[]]$GitArgs, [string]$RepoRoot = (Get-Location).Path)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = 'git.exe'
        $psi.Arguments = Format-Arguments $GitArgs
        $psi.WorkingDirectory = $RepoRoot
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
        $psi.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)

        $proc = [System.Diagnostics.Process]::Start($psi)
        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
        $stderrTask = $proc.StandardError.ReadToEndAsync()

        $proc.WaitForExit()
        [System.Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))

        $outLines = if ($stdoutTask.Result) { @($stdoutTask.Result -split "`r?`n") } else { @() }
        $errLines = if ($stderrTask.Result) { @($stderrTask.Result -split "`r?`n") } else { @() }

        return [PSCustomObject]@{
            ExitCode = [int]$proc.ExitCode
            Stdout   = @($outLines)
            Stderr   = @($errLines)
        }
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Get-RepoStatusSummary {
    param([string]$Branch, [string]$RepoRoot)

    # 1. 取得最新提交
    $latestCommit = (& git log -1 --pretty=format:'%h | %s (%cr)' 2>$null)

    # 2. 检查 Upstream 及 Ahead/Behind
    $upstreamOutput = (& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null | Out-String).Trim()
    $hasUpstream = ($LASTEXITCODE -eq 0 -and $upstreamOutput)
    $aheadCount = 0
    $behindCount = 0
    $remoteBranchName = "origin/$Branch"

    if ($hasUpstream) {
        $counts = (& git rev-list --left-right --count "$upstreamOutput...HEAD" 2>$null | Out-String).Trim()
        if ($counts -match '(\d+)\s+(\d+)') {
            $behindCount = [int]$Matches[1]
            $aheadCount  = [int]$Matches[2]
        }
    } else {
        # 检查远端分支是否存在
        & git rev-parse --verify "origin/$Branch" *> $null
        if ($LASTEXITCODE -eq 0) {
            $counts = (& git rev-list --left-right --count "origin/$Branch...HEAD" 2>$null | Out-String).Trim()
            if ($counts -match '(\d+)\s+(\d+)') {
                $behindCount = [int]$Matches[1]
                $aheadCount  = [int]$Matches[2]
            }
        } else {
            # 远端尚无同名分支，所有本地提交均视作待推送
            $localCommits = (& git rev-list --count HEAD 2>$null | Out-String).Trim()
            if ($localCommits) { $aheadCount = [int]$localCommits }
        }
    }

    # 3. 扫描工作区变更（快速获取）
    $rawStatus = @(& git status --porcelain=v1 -- . ':(exclude)bak/**' 2>$null)

    $staged = [System.Collections.Generic.List[PSObject]]::new()
    $unstaged = [System.Collections.Generic.List[PSObject]]::new()
    $untracked = [System.Collections.Generic.List[PSObject]]::new()

    foreach ($line in $rawStatus) {
        if ($line.Length -lt 3) { continue }
        $x = $line.Substring(0, 1)
        $y = $line.Substring(1, 1)
        $file = $line.Substring(3).Trim()

        if ($x -eq '?' -and $y -eq '?') {
            $untracked.Add([PSCustomObject]@{ Code = '??'; Type = '新增'; Path = $file; Color = 'Green' })
        } else {
            if ($x -ne ' ' -and $x -ne '?') {
                $lbl = switch ($x) { 'A' { '新增' } 'D' { '删除' } 'R' { '重命名' } default { '修改' } }
                $clr = switch ($x) { 'A' { 'Green' } 'D' { 'Red' } 'R' { 'Magenta' } default { 'Cyan' } }
                $staged.Add([PSCustomObject]@{ Code = $x; Type = $lbl; Path = $file; Color = $clr })
            }
            if ($y -ne ' ' -and $y -ne '?') {
                $lbl = switch ($y) { 'D' { '删除' } default { '修改' } }
                $clr = switch ($y) { 'D' { 'Red' } default { 'Cyan' } }
                $unstaged.Add([PSCustomObject]@{ Code = $y; Type = $lbl; Path = $file; Color = $clr })
            }
        }
    }

    return [PSCustomObject]@{
        LatestCommit = $latestCommit
        HasUpstream  = $hasUpstream
        Upstream     = if ($hasUpstream) { $upstreamOutput } else { $remoteBranchName }
        Ahead        = $aheadCount
        Behind       = $behindCount
        Staged       = $staged
        Unstaged     = $unstaged
        Untracked    = $untracked
        TotalChanges = $staged.Count + $unstaged.Count + $untracked.Count
    }
}

function Write-StatusCard {
    param($Summary, [string]$Branch)

    $ruleWidth = 72
    $topBorder = [string]::new($Glyph.H, $ruleWidth - 2)
    $divBorder = [string]::new($Glyph.H, $ruleWidth - 2)
    $botBorder = [string]::new($Glyph.H, $ruleWidth - 2)

    Write-Host ('  ' + $Glyph.TL + $topBorder + $Glyph.TR) -ForegroundColor DarkGray
    
    # 提交与分支信息
    Write-Host ('  ' + $Glyph.V + '  ') -ForegroundColor DarkGray -NoNewline
    Write-Host ($T.HeadCommit + ': ') -ForegroundColor Gray -NoNewline
    if ($Summary.LatestCommit) {
        Write-Host ($Summary.LatestCommit) -ForegroundColor White
    } else {
        Write-Host '(尚无提交)' -ForegroundColor DarkGray
    }
    
    Write-Host ('  ' + $Glyph.V + '  ') -ForegroundColor DarkGray -NoNewline
    Write-Host ($T.BranchLabel + '     : ') -ForegroundColor Gray -NoNewline
    Write-Host $Branch -ForegroundColor Yellow -NoNewline
    Write-Host ('  ➔  ' + $Summary.Upstream) -ForegroundColor DarkGray

    # 同步状态指示
    Write-Host ('  ' + $Glyph.V + '  ') -ForegroundColor DarkGray -NoNewline
    Write-Host ($T.SyncStatus + '     : ') -ForegroundColor Gray -NoNewline
    if ($Summary.Ahead -gt 0 -and $Summary.Behind -gt 0) {
        Write-Host ($T.SyncDiverged -f $Summary.Ahead, $Summary.Behind) -ForegroundColor Yellow
    } elseif ($Summary.Ahead -gt 0) {
        Write-Host ($T.SyncAhead -f $Summary.Ahead) -ForegroundColor Green
    } elseif ($Summary.Behind -gt 0) {
        Write-Host ($T.SyncBehind -f $Summary.Behind) -ForegroundColor Red
    } elseif ($Summary.HasUpstream) {
        Write-Host ($T.SyncSynced) -ForegroundColor DarkGray
    } else {
        Write-Host ($T.SyncNoUpstream) -ForegroundColor Yellow
    }

    Write-Host ('  ' + $Glyph.ML + $divBorder + $Glyph.MR) -ForegroundColor DarkGray

    # 工作区状态
    if ($Summary.TotalChanges -eq 0) {
        Write-Host ('  ' + $Glyph.V + '  ') -ForegroundColor DarkGray -NoNewline
        Write-Host '工作区变更   : ' -ForegroundColor Gray -NoNewline
        Write-Host ($T.CleanRepo) -ForegroundColor Green
        Write-Host ('  ' + $Glyph.BL + $botBorder + $Glyph.BR) -ForegroundColor DarkGray
        return
    }

    Write-Host ('  ' + $Glyph.V + '  未提交变更统计:') -ForegroundColor DarkGray
    Write-Host ('  ' + $Glyph.V + '    ') -ForegroundColor DarkGray -NoNewline
    Write-Host '● 待提交 (已暂存): ' -ForegroundColor Cyan -NoNewline
    Write-Host ($Summary.Staged.Count.ToString() + ' 项') -ForegroundColor White -NoNewline
    Write-Host '   ○ 未暂存 (工作区): ' -ForegroundColor Yellow -NoNewline
    Write-Host ($Summary.Unstaged.Count.ToString() + ' 项') -ForegroundColor White -NoNewline
    Write-Host '   ? 新增项 (未跟踪): ' -ForegroundColor Green -NoNewline
    Write-Host ($Summary.Untracked.Count.ToString() + ' 项') -ForegroundColor White

    Write-Host ('  ' + $Glyph.V) -ForegroundColor DarkGray
    Write-Host ('  ' + $Glyph.V + '  文件预览:') -ForegroundColor DarkGray

    $previewList = [System.Collections.Generic.List[PSObject]]::new()
    foreach ($item in $Summary.Staged) { $previewList.Add($item) }
    foreach ($item in $Summary.Unstaged) {
        if (-not ($previewList | Where-Object { $_.Path -eq $item.Path })) {
            $previewList.Add($item)
        }
    }
    foreach ($item in $Summary.Untracked) {
        if (-not ($previewList | Where-Object { $_.Path -eq $item.Path })) {
            $previewList.Add($item)
        }
    }

    $maxPreview = 4
    $shown = 0
    foreach ($item in $previewList) {
        if ($shown -ge $maxPreview) { break }
        Write-Host ('  ' + $Glyph.V + '    ') -ForegroundColor DarkGray -NoNewline
        Write-Host ('[' + $item.Type + '] ') -ForegroundColor $item.Color -NoNewline
        $displayPath = $item.Path
        if ($displayPath.Length -gt 54) {
            $displayPath = '...' + $displayPath.Substring($displayPath.Length - 51)
        }
        Write-Host $displayPath -ForegroundColor White
        $shown++
    }

    $remaining = $previewList.Count - $shown
    if ($remaining -gt 0) {
        Write-Host ('  ' + $Glyph.V + '    ') -ForegroundColor DarkGray -NoNewline
        Write-Host ('... 其余 ' + $remaining.ToString() + ' 个文件已折叠汇总') -ForegroundColor DarkGray
    }

    Write-Host ('  ' + $Glyph.BL + $botBorder + $Glyph.BR) -ForegroundColor DarkGray
}

function Update-GitPushProgressLine {
    param(
        [string]$RawLine,
        [int]$CurrentPercent
    )

    $line = $RawLine.Trim()
    if (-not $line) { return $CurrentPercent }

    if ($line -match 'Uploading LFS objects:\s+(\d+)%') {
        $sub = [int]$Matches[1]
        $CurrentPercent = 60 + [int]($sub * 0.15)
        Show-DynamicProgress -Percent $CurrentPercent -StepText ($T.Step4 + ': 上传 LFS 对象') -DetailText "LFS: $sub%"
    } elseif ($line -match 'Counting objects:\s+(\d+)%') {
        $sub = [int]$Matches[1]
        $CurrentPercent = 75 + [int]($sub * 0.05)
        Show-DynamicProgress -Percent $CurrentPercent -StepText ($T.Step4 + ': ' + $T.CountingObjects) -DetailText "Counting: $sub%"
    } elseif ($line -match 'Compressing objects:\s+(\d+)%') {
        $sub = [int]$Matches[1]
        $CurrentPercent = 80 + [int]($sub * 0.06)
        Show-DynamicProgress -Percent $CurrentPercent -StepText ($T.Step4 + ': ' + $T.CompressingData) -DetailText "Compressing: $sub%"
    } elseif ($line -match 'Writing objects:\s+(\d+)%(?:.*?\s*([^,]+?)(?:,\s*done)?)?') {
        $sub = [int]$Matches[1]
        $speed = if ($Matches[2]) { " (" + $Matches[2].Trim() + ")" } else { "" }
        $CurrentPercent = 86 + [int]($sub * 0.11)
        Show-DynamicProgress -Percent $CurrentPercent -StepText ($T.Step4 + ': ' + $T.WritingObjects) -DetailText "Writing: $sub%$speed"
    } elseif ($line -match 'Resolving deltas:\s+(\d+)%') {
        $sub = [int]$Matches[1]
        $CurrentPercent = 97 + [int]($sub * 0.03)
        Show-DynamicProgress -Percent $CurrentPercent -StepText ($T.Step4 + ': ' + $T.ResolvingDeltas) -DetailText "Resolving: $sub%"
    }

    return $CurrentPercent
}

function Invoke-GitPushWithRealtimeProgress {
    param(
        [string]$Branch,
        [bool]$HasUpstream,
        [string]$RepoRoot
    )

    $gitArgs = if ($HasUpstream) {
        @('push', '--progress')
    } else {
        @('push', '--progress', '--set-upstream', 'origin', $Branch)
    }

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        # 确保清除任何残留的环境变量，保障 Git LFS 钩子正常上传对象
        Remove-Item Env:\GIT_LFS_SKIP_PUSH -ErrorAction SilentlyContinue

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = 'git.exe'
        $psi.Arguments = Format-Arguments $gitArgs
        $psi.WorkingDirectory = $RepoRoot
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
        $psi.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)

        $lastPct = 70
        Show-DynamicProgress -Percent $lastPct -StepText $T.Step4 -DetailText '正在与 GitHub 建立连接并推送...'
        Render-InputBox -Title $T.Pushing -Hint $T.OpPleaseWait -PromptLabel $T.OpLocked -LabelColor DarkGray

        $proc = [System.Diagnostics.Process]::Start($psi)

        # stdout 与 stderr 按字符块读取并解析进度
        $stdoutReader = $proc.StandardOutput
        $stderrReader = $proc.StandardError
        $stdoutBuffer = [System.Text.StringBuilder]::new()
        $stderrBuffer = [System.Text.StringBuilder]::new()
        $allOutputLines = [System.Collections.Generic.List[string]]::new()

        $stdoutReadBuffer = [char[]]::new(1024)
        $stderrReadBuffer = [char[]]::new(1024)
        $stdoutTask = $stdoutReader.ReadAsync($stdoutReadBuffer, 0, $stdoutReadBuffer.Length)
        $stderrTask = $stderrReader.ReadAsync($stderrReadBuffer, 0, $stderrReadBuffer.Length)

        $pushTimer = [System.Diagnostics.Stopwatch]::StartNew()
        $lastWaitSeconds = -1
        $receivedGitOutput = $false

        while (-not $proc.HasExited -or $null -ne $stdoutTask -or $null -ne $stderrTask) {
            $hadProgress = $false

            if ($null -ne $stderrTask -and $stderrTask.IsCompleted) {
                $readCount = $stderrTask.GetAwaiter().GetResult()
                if ($readCount -eq 0) {
                    $stderrTask = $null
                } else {
                    $hadProgress = $true
                    for ($i = 0; $i -lt $readCount; $i++) {
                        $ch = $stderrReadBuffer[$i]
                        if ($ch -eq "`r" -or $ch -eq "`n") {
                            if ($stderrBuffer.Length -gt 0) {
                                $line = $stderrBuffer.ToString().Trim()
                                [void]$stderrBuffer.Clear()
                                if ($line) {
                                    $receivedGitOutput = $true
                                    $allOutputLines.Add($line)
                                    $lastPct = Update-GitPushProgressLine -RawLine $line -CurrentPercent $lastPct
                                }
                            }
                        } else {
                            [void]$stderrBuffer.Append($ch)
                        }
                    }
                    $stderrReadBuffer = [char[]]::new(1024)
                    $stderrTask = $stderrReader.ReadAsync($stderrReadBuffer, 0, $stderrReadBuffer.Length)
                }
            }

            if ($null -ne $stdoutTask -and $stdoutTask.IsCompleted) {
                $readCount = $stdoutTask.GetAwaiter().GetResult()
                if ($readCount -eq 0) {
                    $stdoutTask = $null
                } else {
                    $hadProgress = $true
                    for ($i = 0; $i -lt $readCount; $i++) {
                        $ch = $stdoutReadBuffer[$i]
                        if ($ch -eq "`r" -or $ch -eq "`n") {
                            if ($stdoutBuffer.Length -gt 0) {
                                $line = $stdoutBuffer.ToString().Trim()
                                [void]$stdoutBuffer.Clear()
                                if ($line) {
                                    $receivedGitOutput = $true
                                    $allOutputLines.Add($line)
                                    $lastPct = Update-GitPushProgressLine -RawLine $line -CurrentPercent $lastPct
                                }
                            }
                        } else {
                            [void]$stdoutBuffer.Append($ch)
                        }
                    }
                    $stdoutReadBuffer = [char[]]::new(1024)
                    $stdoutTask = $stdoutReader.ReadAsync($stdoutReadBuffer, 0, $stdoutReadBuffer.Length)
                }
            }

            if (-not $hadProgress) {
                if (-not $receivedGitOutput) {
                    $waitSeconds = [int]$pushTimer.Elapsed.TotalSeconds
                    if ($waitSeconds -ne $lastWaitSeconds) {
                        $lastWaitSeconds = $waitSeconds
                        Show-DynamicProgress -Percent $lastPct -StepText $T.Step4 -DetailText ('等待 GitHub 响应 ' + $waitSeconds + 's')
                    }
                }
                Start-Sleep -Milliseconds 40
            }
        }

        if ($stderrBuffer.Length -gt 0) {
            $line = $stderrBuffer.ToString().Trim()
            if ($line) { $allOutputLines.Add($line); $lastPct = Update-GitPushProgressLine -RawLine $line -CurrentPercent $lastPct }
        }
        if ($stdoutBuffer.Length -gt 0) {
            $line = $stdoutBuffer.ToString().Trim()
            if ($line) { $allOutputLines.Add($line); $lastPct = Update-GitPushProgressLine -RawLine $line -CurrentPercent $lastPct }
        }

        $proc.WaitForExit()
        $exitCode = [int]$proc.ExitCode

        if ($exitCode -ne 0) {
            $combined = $allOutputLines -join [Environment]::NewLine
            $errTitle = $T.Incomplete
            $errTip = ''
            if ($combined -match 'rejected.*fetch first|non-fast-forward') {
                $errTitle = $T.ErrRejected
                $errTip = $T.ErrRejectedTip
            } elseif ($combined -match 'Authentication failed|Permission to.*denied') {
                $errTitle = $T.ErrAuth
                $errTip = $T.ErrAuthTip
            } elseif ($combined -match 'Failed to connect|Connection timed out|Could not resolve host') {
                $errTitle = $T.ErrNet
                $errTip = $T.ErrNetTip
            } elseif ($combined -match 'Missing LFS object|pre-receive hook declined') {
                $errTitle = '推送被远端拒绝 (LFS 校验未通过)'
                $errTip = '远端缺少对应的 LFS 大文件对象。'
            } else {
                $lastErr = ($allOutputLines | Where-Object { $_ -and $_ -notmatch '^(Counting|Compressing|Writing|Resolving)' } | Select-Object -Last 1)
                if ($lastErr) { $errTip = $lastErr }
            }

            Show-DynamicProgress -Percent $lastPct -StepText '推送失败' -DetailText "退出码 $exitCode"
            Read-BottomInput -Title $errTitle -Hint $errTip -DefaultValue '' -PromptLabel '[Enter] > ' -LabelColor Red | Out-Null
            return $exitCode
        }

        Show-DynamicProgress -Percent 100 -StepText ($T.Step4 + ': 推送完成！') -DetailText ('已同步至 origin/' + $Branch)
        return 0
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}

function Main {
    $PushedLocation = $false
    $script:FinalMessage = $T.Incomplete
    try {
        $RepoRoot = Split-Path -Parent $PSScriptRoot
        Push-Location -LiteralPath $RepoRoot
        $PushedLocation = $true

        Write-Header

        # 检查 Git 与仓库
        & git rev-parse --is-inside-work-tree *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host ('  ' + $T.RepoError) -ForegroundColor Red
            return 1
        }

        & git remote get-url origin *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host ('  ' + $T.OriginError) -ForegroundColor Red
            return 1
        }

        $BranchOutput = & git branch --show-current 2>$null
        $Branch = ($BranchOutput -join '').Trim()
        if (-not $Branch) {
            Write-Host ('  ' + $T.BranchError) -ForegroundColor Red
            return 1
        }

        # 步骤 1: 扫描状态并渲染看板
        $Summary = Get-RepoStatusSummary -Branch $Branch -RepoRoot $RepoRoot
        Write-StatusCard -Summary $Summary -Branch $Branch

        # 如果落后于远端，在看板下直接提示
        if ($Summary.Behind -gt 0) {
            Write-Host ('  ' + ($T.BehindWarning -f $Summary.Behind)) -ForegroundColor Yellow
        }

        # 获取当前卡片底部所在的 Y 坐标并初始化锁定布局
        $cardBottom = 16
        try {
            $cardBottom = $Host.UI.RawUI.CursorPosition.Y
        } catch {}
        Init-ScreenLayout -CardBottomRow $cardBottom

        # 进度条单排初始化
        Show-DynamicProgress -Percent 25 -StepText $T.Step1 -DetailText '就绪'

        # 分支逻辑判定：
        # 情况 A: 工作区干净且无未推送提交
        if ($Summary.TotalChanges -eq 0 -and $Summary.Ahead -eq 0) {
            Show-DynamicProgress -Percent 100 -StepText '完成' -DetailText $T.AlreadyClean
            $ans = Read-BottomInput -Title $T.AlreadyClean -Hint $T.ReloadHint -DefaultValue 'reload' -PromptLabel $T.ReloadLabel -LabelColor Green
            if ($ans.Trim().ToUpperInvariant() -eq 'Q') {
                $script:FinalMessage = $T.AlreadyClean
                return 0
            }
            $script:ShouldReload = $true
            return 0
        }

        # 情况 B: 工作区干净，但有未推送提交 (Ahead > 0)
        if ($Summary.TotalChanges -eq 0 -and $Summary.Ahead -gt 0) {
            Show-DynamicProgress -Percent 30 -StepText '检测到未推送提交' -DetailText ($Summary.Ahead.ToString() + ' 个提交待推送')
            $Answer = Read-BottomInput -Title $T.ConfirmPushAhead -Hint $T.ConfirmHint -DefaultValue 'Y' -PromptLabel '[Y/N] > ' -LabelColor Yellow
            if ($Answer.Trim().ToUpperInvariant() -ne 'Y') {
                Show-DynamicProgress -Percent 25 -StepText $T.Cancelled -DetailText '未执行推送'
                Read-BottomInput -Title $T.Cancelled -Hint $T.ExitHint -DefaultValue '' -PromptLabel '[Enter] > ' -LabelColor Gray | Out-Null
                $script:FinalMessage = $T.Cancelled
                return 0
            }

            Render-InputBox -Title $T.Pushing -Hint $T.OpPleaseWait -PromptLabel $T.OpLocked -LabelColor DarkGray
            $PushCode = Invoke-GitPushWithRealtimeProgress -Branch $Branch -HasUpstream $Summary.HasUpstream -RepoRoot $RepoRoot
            if ($PushCode -ne 0) { return $PushCode }

            $ans = Read-BottomInput -Title $T.Complete -Hint $T.ReloadHint -DefaultValue 'reload' -PromptLabel $T.ReloadLabel -LabelColor Green
            if ($ans.Trim().ToUpperInvariant() -eq 'Q') {
                $script:FinalMessage = $T.Complete
                return 0
            }
            $script:ShouldReload = $true
            return 0
        }

        # 情况 C: 工作区有未提交变更
        $CommitMessage = Read-BottomInput -Title $T.CommitInput -Hint $T.InputHint -DefaultValue $T.DefaultCommit -PromptLabel '> ' -LabelColor Cyan
        $Answer = Read-BottomInput -Title $T.ConfirmPublish -Hint $T.ConfirmHint -DefaultValue 'Y' -PromptLabel '[Y/N] > ' -LabelColor Yellow
        if ($Answer.Trim().ToUpperInvariant() -ne 'Y') {
            Show-DynamicProgress -Percent 25 -StepText $T.Cancelled -DetailText '未执行提交或推送'
            Read-BottomInput -Title $T.Cancelled -Hint $T.ExitHint -DefaultValue '' -PromptLabel '[Enter] > ' -LabelColor Gray | Out-Null
            $script:FinalMessage = $T.Cancelled
            return 0
        }

        # 步骤 2: 暂存变更
        Show-DynamicProgress -Percent 35 -StepText ($T.Step2 + ' (git add)...')
        Render-InputBox -Title ($T.Step2 + '...') -Hint $T.OpPleaseWait -PromptLabel $T.OpLocked -LabelColor DarkGray

        # 保护：重置任何可能误入索引的 bak/**
        & git diff --cached --quiet -- ':(glob)bak/**'
        if ($LASTEXITCODE -eq 1) {
            & git reset -q -- ':(glob)bak/**' *> $null
        }

        $addRes = Invoke-GitDirect -GitArgs @('add', '-A', '--ignore-errors', '--', '.') -RepoRoot $RepoRoot
        if ($addRes.ExitCode -ne 0) {
            Show-DynamicProgress -Percent 35 -StepText '暂存失败' -DetailText 'git add 异常'
            $errDetail = ($addRes.Stderr | Where-Object { $_ }) -join ' '
            Read-BottomInput -Title '暂存文件失败' -Hint $errDetail -DefaultValue '' -PromptLabel '[Enter] > ' -LabelColor Red | Out-Null
            return 1
        }

        & git diff --cached --quiet
        $hasStaged = ($LASTEXITCODE -ne 0)

        if (-not $hasStaged) {
            if ($Summary.Ahead -gt 0) {
                Show-DynamicProgress -Percent 50 -StepText '第 2/4 步: 无新增变更' -DetailText ('准备推送已有 ' + $Summary.Ahead + ' 个提交')
            } else {
                Show-DynamicProgress -Percent 100 -StepText '完成' -DetailText $T.NoChanges
                Read-BottomInput -Title $T.NoChanges -Hint $T.ExitHint -DefaultValue '' -PromptLabel '[Enter] > ' -LabelColor Green | Out-Null
                $script:FinalMessage = $T.NoChanges
                return 0
            }
        } else {
            $shortStat = (& git diff --cached --shortstat -- . ':(exclude)bak/**' 2>$null)
            $statDetail = if ($shortStat) { $shortStat.Trim() } else { '变更已暂存' }
            Show-DynamicProgress -Percent 50 -StepText '第 2/4 步: 变更文件暂存完成' -DetailText $statDetail

            # 步骤 3: 本地提交
            Show-DynamicProgress -Percent 65 -StepText ($T.Step3 + ' (git commit)...')
            Render-InputBox -Title ($T.Step3 + '...') -Hint $T.OpPleaseWait -PromptLabel $T.OpLocked -LabelColor DarkGray

            $commitRes = Invoke-GitDirect -GitArgs @('commit', '-m', $CommitMessage) -RepoRoot $RepoRoot
            if ($commitRes.ExitCode -ne 0) {
                Show-DynamicProgress -Percent 65 -StepText '提交失败' -DetailText 'git commit 异常'
                $errDetail = ($commitRes.Stderr | Where-Object { $_ }) -join ' '
                Read-BottomInput -Title '本地提交失败' -Hint $errDetail -DefaultValue '' -PromptLabel '[Enter] > ' -LabelColor Red | Out-Null
                return 1
            }

            $newCommit = (& git log -1 --pretty=format:'%h' 2>$null)
            Show-DynamicProgress -Percent 75 -StepText '第 3/4 步: 本地提交已创建' -DetailText ('Commit: ' + $newCommit)
        }

        # 步骤 4: 实时推送（流式单排更新）
        $PushCode = Invoke-GitPushWithRealtimeProgress -Branch $Branch -HasUpstream $Summary.HasUpstream -RepoRoot $RepoRoot
        if ($PushCode -ne 0) { return $PushCode }

        $ans = Read-BottomInput -Title $T.Complete -Hint $T.ReloadHint -DefaultValue 'reload' -PromptLabel $T.ReloadLabel -LabelColor Green
        if ($ans.Trim().ToUpperInvariant() -eq 'Q') {
            $script:FinalMessage = $T.Complete
            return 0
        }
        $script:ShouldReload = $true
        return 0
    } catch {
        Show-DynamicProgress -Percent 0 -StepText '发生异常' -DetailText $_.Exception.Message
        Read-BottomInput -Title $T.GitError -Hint $_.Exception.Message -DefaultValue '' -PromptLabel '[Enter] > ' -LabelColor Red | Out-Null
        return 1
    } finally {
        if ($PushedLocation) { Pop-Location }
        try {
            Set-Cursor 0 ($script:InputBottomRow + 1)
            Write-Host ''
        } catch {}
    }
}

$PublisherMutex = [System.Threading.Mutex]::new($false, 'Local\CodeXaStudioGitHubPublisher')
$HasPublisherMutex = $false
try {
    try {
        $HasPublisherMutex = $PublisherMutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $HasPublisherMutex = $true
    }

    if (-not $HasPublisherMutex) {
        Write-Host ('  ' + $T.AlreadyRunning) -ForegroundColor Yellow
        $script:FinalMessage = $T.Incomplete
        $ExitCode = 1
    } else {
        do {
            $script:ShouldReload = $false
            $ExitCode = Main
        } while ($ExitCode -eq 0 -and $script:ShouldReload)
    }

    exit $ExitCode
} finally {
    if ($HasPublisherMutex) { $PublisherMutex.ReleaseMutex() }
    $PublisherMutex.Dispose()
}
