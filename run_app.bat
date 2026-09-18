@echo off
title Workshop Attendance & Payroll PWA
cd /d "%~dp0"
echo ========================================================
echo   Workshop Attendance, Daily Logging & Payroll (PWA)
echo   Local-First Offline Application (Zero Server)
echo ========================================================
echo.
echo Launching local server at http://localhost:8080 ...
start "" http://localhost:8080
python -m http.server 8080 --directory "dist"
if %errorlevel% neq 0 (
  echo Python not found, trying Vite preview...
  npm run preview -- --port 8080 --host
)
pause
