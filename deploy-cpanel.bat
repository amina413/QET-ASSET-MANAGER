@echo off
cd /d "%~dp0"
echo Building for cPanel...
call npm run build
if %errorlevel% neq 0 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Creating deployment ZIP (excluding node_modules, .git)...
powershell -Command "Compress-Archive -Path .next, public, prisma, app, components, lib, utils, types.ts, constants.ts, package.json, package-lock.json, server.js, next.config.ts, tsconfig.json, tailwind.config.js, postcss.config.js -DestinationPath deploy-cpanel.zip -Force"
echo.
echo Done. Upload deploy-cpanel.zip to cPanel.
echo Then: extract, run 'npm install --production', run 'npx prisma migrate deploy'
pause
