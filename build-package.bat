@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0" || (
    echo 无法进入项目目录。
    pause
    exit /b 1
)

echo ========================================
echo   CodeXa Studio - 构建安装包与便携版
echo ========================================
echo.

where.exe npm >nul 2>&1
if errorlevel 1 (
    echo 未找到 npm，请先安装 Node.js。
    set "EXIT_CODE=1"
    goto :failed
)

if not exist "package.json" (
    echo 未找到 package.json，请确认脚本位于项目根目录。
    set "EXIT_CODE=1"
    goto :failed
)

if not exist "node_modules" (
    echo 未找到 node_modules，请先运行 npm install。
    set "EXIT_CODE=1"
    goto :failed
)

echo 正在执行 npm run build...
echo.
call npm run build
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo 构建完成，生成文件：
if exist "dist-electron\*.exe" dir /b /a-d "dist-electron\*.exe"
echo.
echo 解压目录：
echo %CD%\dist-electron\win-unpacked
echo.
popd
pause
exit /b 0

:failed
echo.
echo 构建失败，退出码：%EXIT_CODE%
popd
pause
exit /b %EXIT_CODE%
