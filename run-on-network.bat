@echo off
:: Run this as Administrator for network access (right-click -> Run as administrator)
cd /d "%~dp0"

echo ========================================
echo  ABDC Asset Manager - Network Mode
echo ========================================
echo.

:: Add firewall rule so other devices can connect
netsh advfirewall firewall add rule name="Next.js Dev Port 3000" dir=in action=allow protocol=tcp localport=3000 2>nul
if %errorlevel% equ 0 (
  echo [OK] Firewall rule added - port 3000 allowed for network access.
) else (
  echo [!] Run this file as Administrator: right-click -^> Run as administrator
  echo     Otherwise other devices may not be able to connect.
)
echo.

echo Starting server...
echo.
echo Local:   http://localhost:3000
echo Network: http://192.168.0.129:3000  (use your PC IP - run ipconfig to find it)
echo.
echo Press Ctrl+C to stop.
echo ========================================

npm run dev
pause
