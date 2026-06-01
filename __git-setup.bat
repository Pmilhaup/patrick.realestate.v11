@echo off
title v11 Git Setup
echo === Checking git ===
where git >nul 2>&1
if errorlevel 1 (
    echo.
    echo Git is NOT on PATH. Close this window, close ALL PowerShell windows,
    echo open a fresh PowerShell, then double-click this file again.
    echo.
    pause
    exit /b 1
)
git --version

cd /d "%~dp0"
echo.
echo === Working dir: %CD%
echo.
echo === Cleaning up old .git stub ===
if exist .git rmdir /s /q .git

echo === Initializing repo ===
git init -b main
git config user.name "Patrick Milhaupt"
git config user.email "pmilhaupt@jamesonsir.com"

echo.
echo === Staging files ===
git add -A

echo.
echo === Committing ===
git commit -m "v11 initial commit -- chapter-narrative + v3.4 brand + verified facts"

echo.
echo === Adding GitHub remote ===
git remote remove origin 2>nul
git remote add origin https://github.com/Pmilhaup/patrick.realestate.v11.git

echo.
echo === Pushing to GitHub ===
echo A browser window will pop up for GitHub sign-in. Sign in as Pmilhaup.
echo.
git push -u origin main

echo.
echo ============================================================
echo === Done. Refresh github.com/Pmilhaup/patrick.realestate.v11
echo ============================================================
echo.
pause
