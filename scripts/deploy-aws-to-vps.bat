@echo off
REM Deploy AWS Integration to VPS
REM This script copies all AWS-related files to the VPS server

setlocal enabledelayedexpansion

set SSH_KEY="C:\Users\shala\.ssh\nexora_vps_key"
set VPS_IP=147.79.71.176
set VPS_USER=root
set VPS_PATH=/var/www/nexora-api

echo ========================================
echo AWS Integration VPS Deployment
echo ========================================
echo.

echo Step 1: Copying AWS configuration files...
scp -i %SSH_KEY% src\config\aws.js %VPS_USER%@%VPS_IP%:%VPS_PATH%/src/config/
if errorlevel 1 (
    echo ERROR: Failed to copy aws.js
    pause
    exit /b 1
)
echo   - aws.js copied successfully
echo.

echo Step 2: Copying AWS service files...
scp -i %SSH_KEY% src\services\aws-s3.service.js %VPS_USER%@%VPS_IP%:%VPS_PATH%/src/services/
if errorlevel 1 (
    echo ERROR: Failed to copy aws-s3.service.js
    pause
    exit /b 1
)
echo   - aws-s3.service.js copied successfully

scp -i %SSH_KEY% src\services\aws-ses.service.js %VPS_USER%@%VPS_IP%:%VPS_PATH%/src/services/
if errorlevel 1 (
    echo ERROR: Failed to copy aws-ses.service.js
    pause
    exit /b 1
)
echo   - aws-ses.service.js copied successfully
echo.

echo Step 3: Copying updated server files...
scp -i %SSH_KEY% src\index.js %VPS_USER%@%VPS_IP%:%VPS_PATH%/src/
if errorlevel 1 (
    echo ERROR: Failed to copy index.js
    pause
    exit /b 1
)
echo   - index.js copied successfully

scp -i %SSH_KEY% src\modules\auth\signup.service.js %VPS_USER%@%VPS_IP%:%VPS_PATH%/src/modules/auth/
if errorlevel 1 (
    echo ERROR: Failed to copy signup.service.js
    pause
    exit /b 1
)
echo   - signup.service.js copied successfully

scp -i %SSH_KEY% package.json %VPS_USER%@%VPS_IP%:%VPS_PATH%/
if errorlevel 1 (
    echo ERROR: Failed to copy package.json
    pause
    exit /b 1
)
echo   - package.json copied successfully
echo.

echo Step 4: Installing AWS SDK packages on VPS...
ssh -i %SSH_KEY% %VPS_USER%@%VPS_IP% "cd %VPS_PATH% && npm install @aws-sdk/s3-request-presigner --save"
if errorlevel 1 (
    echo WARNING: Failed to install packages (might already be installed)
)
echo   - Packages installation attempted
echo.

echo Step 5: Restarting API server...
ssh -i %SSH_KEY% %VPS_USER%@%VPS_IP% "pm2 restart nexora-api"
if errorlevel 1 (
    echo ERROR: Failed to restart API server
    pause
    exit /b 1
)
echo   - API server restarted successfully
echo.

echo Step 6: Checking server logs...
echo ========================================
ssh -i %SSH_KEY% %VPS_USER%@%VPS_IP% "pm2 logs nexora-api --lines 30 --nostream"
echo ========================================
echo.

echo Deployment complete!
echo.
echo Next steps:
echo 1. Add AWS credentials to VPS .env.local file
echo 2. Test signup flow: https://nexoraos.pro/signup
echo 3. Check if welcome email is sent
echo 4. Monitor logs: ssh -i %SSH_KEY% %VPS_USER%@%VPS_IP% "pm2 logs nexora-api"
echo.
pause
