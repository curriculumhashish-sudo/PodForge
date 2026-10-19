@echo off
setlocal EnableExtensions
cd /d "%~dp0..\frontend"

call "%~dp0find-node.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ERROR] Frontend dependencies are missing. Run setup.bat first.
  pause
  exit /b 1
)

echo PaiAgent Studio ^> http://127.0.0.1:5180
echo Press Ctrl+C to stop.
echo.

call npm run dev
if errorlevel 1 pause
exit /b 0
