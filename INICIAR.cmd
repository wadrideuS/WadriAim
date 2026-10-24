@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instala Node.js 22.12 o posterior desde https://nodejs.org/
 pause
 exit /b 1
)
if not exist "node_modules\vite" (
 call npm.cmd ci
 if errorlevel 1 exit /b 1
)
call npm.cmd run dev -- --open
