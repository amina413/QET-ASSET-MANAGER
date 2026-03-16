@echo off
:: Run this as Administrator to allow network access to the dev server
netsh advfirewall firewall add rule name="Next.js Dev Port 3000" dir=in action=allow protocol=tcp localport=3000
if %errorlevel% equ 0 (
  echo Firewall rule added. Port 3000 is now allowed for network access.
) else (
  echo Failed. Right-click this file and choose "Run as administrator".
)
pause
