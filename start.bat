@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo [ERROR] Backend environment is missing. Run setup.bat first.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo [ERROR] Frontend dependencies are missing. Run setup.bat first.
  pause
  exit /b 1
)

echo Starting PaiAgent Studio...
start "PaiAgent Backend" cmd /k ""%~dp0scripts\start-backend.bat""
start "PaiAgent Frontend" cmd /k ""%~dp0scripts\start-frontend.bat""

echo Waiting for services to come online...
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5180"

echo.
echo Backend:  http://127.0.0.1:8010
echo Frontend: http://127.0.0.1:5180
echo Close the two service windows to stop.
echo.
exit /b 0
