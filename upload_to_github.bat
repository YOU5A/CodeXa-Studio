@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0" || exit /b 1

where.exe wt.exe >nul 2>&1
if not errorlevel 1 (
    rem Avoid a trailing backslash before the closing quote; wt.exe otherwise merges the arguments.
    wt.exe -w new new-tab --title "CodeXa Studio | GitHub Publisher" --colorScheme "One Half Dark" --startingDirectory "%~dp0." powershell.exe -NoLogo -NoProfile -NoExit -ExecutionPolicy Bypass -File .\tools\upload_to_github.ps1
    exit /b 0
)

mode con: cols=110 lines=32 >nul 2>&1
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\upload_to_github.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
