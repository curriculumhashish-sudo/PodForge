@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================
echo  PaiAgent Studio - one-time setup
echo ==========================================
echo.

call "%~dp0scripts\find-node.bat"
if errorlevel 1 goto :failed

set "PY_LAUNCHER=py -3.12"
py -3.12 -c "import sys" >nul 2>&1
if errorlevel 1 set "PY_LAUNCHER=python"
%PY_LAUNCHER% -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python 3.12+ was not found.
  echo         Install it from https://www.python.org/downloads/ and run setup.bat again.
  goto :failed
)

echo [1/4] Preparing Python environment...
if not exist "backend\.venv\Scripts\python.exe" (
  %PY_LAUNCHER% -m venv "backend\.venv"
  if errorlevel 1 goto :failed
)
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
if errorlevel 1 goto :failed
"backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if errorlevel 1 goto :failed

echo.
echo [2/4] Preparing model configuration...
if not exist "backend\.env" (
  copy /Y "backend\.env.example" "backend\.env" >nul
  echo [ok] Created backend\.env - add LLM_API_KEY to use a real model.
) else (
  echo [ok] backend\.env already exists.
)

echo.
echo [3/4] Installing frontend dependencies...
pushd "frontend"
call npm install --no-audit --no-fund
if errorlevel 1 (
  popd
  goto :failed
)
popd

echo.
echo [4/4] Running checks...
pushd "backend"
".venv\Scripts\python.exe" -m unittest discover -s "tests"
if errorlevel 1 (
  popd
  goto :failed
)
popd

echo.
echo ==========================================
echo  Setup complete.
echo  Run start.bat, then open http://127.0.0.1:5180
echo ==========================================
pause
exit /b 0

:failed
echo.
echo Setup failed. Review the message above and try again.
pause
exit /b 1
