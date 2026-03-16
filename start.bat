@echo off
cd /d "%~dp0"
echo ========================================
echo  ABDC Asset Management System
echo ========================================
echo.
echo Local:   http://localhost:3000
echo Network: Use your PC's IP (run ipconfig to find it), e.g. http://192.168.0.54:3000
echo.
echo If other devices cannot connect, run allow-firewall.bat as Administrator.
echo Press Ctrl+C to stop the server.
echo ========================================
npm run dev
pause
