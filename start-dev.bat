@echo off
chcp 65001 >nul
cd /d "D:\Code\CodeXa-Studio"

set PORT=5173

REM =============================================
REM  检测开发环境是否已在运行
REM =============================================
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set PID=%%a
    goto :stop
)

REM ---- 未运行，启动开发环境 ----
echo ========================================
echo   CodeXa Studio - 启动开发环境
echo ========================================
echo.
echo 正在启动 Vite + Electron 开发模式...
echo.

call npm run dev
goto :end

REM ---- 已在运行，停止并关闭 ----
:stop
echo ========================================
echo   CodeXa Studio - 开发环境正在运行
echo ========================================
echo.

echo [1/4] 向上查找父级 cmd.exe 窗口...
set "CMD_PID="
set "CURRENT_PID=%PID%"

:find_parent
for /f "tokens=2 delims==" %%a in ('wmic process where "ProcessId=%CURRENT_PID%" get ParentProcessId /value 2^>nul ^| findstr "="') do (
    set "NEXT_PID=%%a"
    for /f "tokens=2 delims==" %%b in ('wmic process where "ProcessId=%%a" get Name /value 2^>nul ^| findstr "="') do (
        if /I "%%b"=="cmd.exe" (
            set "CMD_PID=%%a"
            goto :found
        )
        if /I "%%b"=="powershell.exe" (
            set "CMD_PID=%%a"
            goto :found
        )
    )
    set "CURRENT_PID=%%a"
    goto :find_parent
)

:found
if defined CMD_PID (
    echo       找到 cmd.exe 窗口 (PID: %CMD_PID%)
) else (
    echo       未找到关联的命令行窗口，继续清理进程...
)

echo [2/4] 关闭 Vite 开发服务器 (端口 %PORT%, PID: %PID%)...
taskkill /PID %PID% /F /T >nul 2>&1
if %errorlevel% equ 0 (
    echo       已关闭 Vite 服务器及子进程树。
) else (
    echo       无法终止 PID: %PID%，请以管理员身份运行。
)

echo [3/4] 关闭命令行窗口...
if defined CMD_PID (
    taskkill /PID %CMD_PID% /F >nul 2>&1
    if %errorlevel% equ 0 (
        echo       已关闭命令行窗口。
    ) else (
        echo       无法关闭命令行窗口，请手动关闭。
    )
) else (
    echo       未找到需要关闭的命令行窗口。
)

echo [4/4] 关闭 Electron 窗口...
taskkill /IM "CodeXa Studio.exe" /F >nul 2>&1
taskkill /IM "electron.exe" /F >nul 2>&1
echo       已关闭 Electron 窗口。

echo.
echo 开发环境已停止。

:end
echo.
pause
