@echo off
setlocal
cd /d "%~dp0"
title Medical Server One-Click Setup

echo ===============================
echo   Medical Server One-Click
echo ===============================
echo.

echo 📍 Script started in:
echo %CD%
echo.

:: ===============================
:: CHECK NODE
:: ===============================
where node >nul 2>&1 || (
  echo ❌ Node.js not installed
  pause
  exit /b
)

:: ===============================
:: CHECK PYTHON
:: ===============================
where python >nul 2>&1 || (
  echo ❌ Python not installed
  pause
  exit /b
)

:: ===============================
:: CHECK GIT
:: ===============================
where git >nul 2>&1 || (
  echo ❌ Git not installed
  pause
  exit /b
)

:: ===============================
:: CLONE REPO
:: ===============================
IF NOT EXIST medical (
  echo 📦 Cloning repository...
  git clone https://github.com/bmasmhj/medical.git
  IF ERRORLEVEL 1 (
    echo ❌ Git clone failed
    pause
    exit /b
  )
)

:: ===============================
:: ENTER PROJECT (HARD LOCK)
:: ===============================
pushd medical || (
  echo ❌ Failed to enter medical directory
  pause
  exit /b
)

echo 📍 Now running in:
echo %CD%
echo.

:: ===============================
:: VERIFY package.json
:: ===============================
IF NOT EXIST package.json (
  echo ❌ package.json NOT found in:
  echo %CD%
  dir
  pause
  popd
  exit /b
)

:: ===============================
:: PNPM
:: ===============================
where pnpm >nul 2>&1 || (
  echo 📦 Installing pnpm...
  call npm install -g pnpm
)

:: ===============================
:: INSTALL
:: ===============================
echo 📦 Installing dependencies...
call pnpm install || (
  echo ❌ pnpm install failed
  pause
  popd
  exit /b
)

:: ===============================
:: VERYFY PYTHON VENV
:: ===============================

IF NOT EXIST .venv (
  echo 🐍 Creating Python virtual environment...
  python -m venv .venv || (
    echo ❌ Failed to create Python virtual environment
    pause
    popd
    exit /b
  )
)

:: ===============================
:: ACTIVATE VENV
:: ===============================

echo 🐍 Activating Python virtual environment...
call .venv\Scripts\activate.bat
IF ERRORLEVEL 1 (
  echo ❌ Failed to activate Python virtual environment
  pause
  popd
  exit /b
)

:: ===============================
:: INSTALL PYTHON REQS
:: ===============================

echo 🐍 Installing Python requirements...
call pip install -r requirements.txt || (
  echo ❌ Failed to install Python requirements
  pause
  popd
  exit /b
)

:: ===============================
:: START
:: ===============================
echo.
echo 🚀 Starting server...
echo.
call pnpm start

popd
pause