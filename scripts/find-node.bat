@echo off
rem Locate a Node.js 20+ runtime and prepend it to PATH for this shell.
setlocal EnableExtensions

set "ROOT=%~dp0.."
set "FOUND="

if exist "%ROOT%\.tools\node\node.exe" (
  call :check "%ROOT%\.tools\node"
  if defined FOUND goto :ready
)

if exist "%ROOT%\..\myPaiAgent\.tools\node\node.exe" (
  call :check "%ROOT%\..\myPaiAgent\.tools\node"
  if defined FOUND goto :ready
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" >nul 2>&1
if not errorlevel 1 (
  set "FOUND=system"
  goto :ready
)

echo [ERROR] Node.js 20+ was not found.
echo         Install it from https://nodejs.org and run setup.bat again.
exit /b 1

:check
"%~1\node.exe" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" >nul 2>&1
if not errorlevel 1 (
  set "FOUND=%~1"
  set "PATH=%~1;%PATH%"
)
exit /b 0

:ready
if /i not "%FOUND%"=="system" (
  set "PATH=%FOUND%;%PATH%"
  echo [ok] Node runtime: %FOUND%
) else (
  echo [ok] Node runtime: system PATH
)

endlocal & set "PATH=%PATH%"
exit /b 0
