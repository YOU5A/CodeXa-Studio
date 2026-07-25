@echo off
chcp 65001 >nul
cd /d "D:\Code\CodeXa-Studio"

echo ========================================
echo   CodeXa Studio - 关闭开发端口
echo ========================================
echo.

set PORT=5173

echo 正在查找占用端口 %PORT% 的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set PID=%%a
    goto :kill
)

echo [OK] 端口 %PORT% 未被占用。
goto :end

:kill
echo 正在终止进程 PID: %PID% ...
taskkill /PID %PID% /F >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 已成功关闭端口 %PORT% (PID: %PID%)。
) else (
    echo [FAIL] 无法终止进程 PID: %PID%，请尝试以管理员身份运行。
)

:end
echo.
pause
