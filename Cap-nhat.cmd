@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0" || goto :failed
title Cap nhat Web App Hong Thien

if not exist "src\WebApp.gs" goto :extract
if not exist "scripts\cap-nhat.cjs" goto :extract
if not exist "package-lock.json" goto :extract
where node.exe >nul 2>nul || goto :node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)" || goto :node

if exist "node_modules\@google\clasp\build\src\index.js" goto :update
where npm.cmd >nul 2>nul || goto :node
echo Dang cai cong cu Google clasp cho thu muc nay...
call npm.cmd ci --include=dev --no-audit --no-fund
if errorlevel 1 goto :failed

:update
node "scripts\cap-nhat.cjs"
if errorlevel 1 goto :failed
popd
pause
exit /b 0

:extract
echo Hay giai nen TOAN BO ZIP, roi mo Cap-nhat.cmd trong thu muc co package.json.
goto :failed
:node
echo Can Node.js 22 tro len va npm. Tai Node.js LTS tai https://nodejs.org/
:failed
echo Da dung. Xem thong bao ngay phia tren.
pause
exit /b 1
