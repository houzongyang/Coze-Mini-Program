@echo off
setlocal
cd /d "%~dp0"
if not defined API_ENV set "API_ENV=development"

set "TARO_CLI=node_modules\@tarojs\cli\bin\taro"
if not exist "%TARO_CLI%" (
  for /d %%D in ("node_modules\.pnpm\@tarojs+cli@*") do (
    if exist "%%~fD\node_modules\@tarojs\cli\bin\taro" set "TARO_CLI=%%~fD\node_modules\@tarojs\cli\bin\taro"
  )
)

if not exist "%TARO_CLI%" (
  echo Taro CLI was not found. Run pnpm install first. > "%~dp0weapp-build.log"
  exit /b 1
)

node "%TARO_CLI%" build --type weapp > "%~dp0weapp-build.log" 2>&1
exit /b %ERRORLEVEL%
