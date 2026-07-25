@echo off
chcp 65001 >nul
cd /d "D:\Code\CodeXa-Studio"

echo ========================================
echo   CodeXa Studio - 启动开发环境
echo ========================================
echo.
echo 正在启动 Vite + Electron 开发模式...
echo.

call npm run dev

pause
