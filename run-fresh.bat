@echo off
cd /d "%~dp0"
echo Clearing old dev lock (if any)...
if exist ".next\dev\lock" del ".next\dev\lock"
echo.
echo Starting QET Asset Management System...
echo When you see "Ready", open:  http://localhost:3000
echo (or http://localhost:3001 if 3000 is in use)
echo Press Ctrl+C to stop.
echo.
npm run dev
pause
