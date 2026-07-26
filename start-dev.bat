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

echo [1/2] 关闭 Vite 开发服务器 (端口 %PORT%, PID: %PID%)...
taskkill /PID %PID% /F >nul 2>&1
if %errorlevel% equ 0 (
    echo       已关闭 Vite 服务器。
) else (
    echo       无法终止 PID: %PID%，请以管理员身份运行。
)

echo [2/2] 关闭 Electron 窗口...
taskkill /IM "CodeXa Studio.exe" /F >nul 2>&1
taskkill /IM "electron.exe" /F >nul 2>&1
echo       已关闭 Electron 窗口。

echo.
echo 开发环境已停止。

:end
echo.
pause