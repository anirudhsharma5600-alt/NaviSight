@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "VITE_SCRIPT=%PROJECT_DIR%node_modules\vite\bin\vite.js"

if not exist "%NODE_EXE%" (
  echo Navi AI's bundled Node.js runtime was not found:
  echo %NODE_EXE%
  echo Open this project in Codex or install Node.js for this computer.
  exit /b 1
)

if not exist "%VITE_SCRIPT%" (
  echo Project dependencies are missing. The Vite app cannot start yet.
  echo Ask the project maintainer to install the dependencies, then try again.
  exit /b 1
)

echo.
echo After Vite says it is ready, open this exact evaluation page:
echo http://127.0.0.1:5173/model-evaluation
echo.

pushd "%PROJECT_DIR%"
"%NODE_EXE%" "%VITE_SCRIPT%" --host 127.0.0.1 --port 5173 --strictPort
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
