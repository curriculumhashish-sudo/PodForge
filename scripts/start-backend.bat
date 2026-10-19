@echo off
setlocal EnableExtensions
cd /d "%~dp0..\backend"

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Backend environment is missing. Run setup.bat first.
  pause
  exit /b 1
)

echo PaiAgent Studio API
echo http://127.0.0.1:8010  ^|  API docs: http://127.0.0.1:8010/docs
echo Press Ctrl+C to stop.
echo.

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8010
if errorlevel 1 pause
exit /b 0
