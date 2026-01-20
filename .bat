@echo off
title Medical Server Setup
echo ===============================
echo   Medical Server Installer
echo ===============================

:: check node
node -v >nul 2>&1
IF ERRORLEVEL 1 (
  echo Node.js not found!
  echo Please install Node.js LTS first.
  pause
  exit /b
)

:: check git
git --version >nul 2>&1
IF ERRORLEVEL 1 (
  echo Git not found!
  echo Please install Git first.
  pause
  exit /b
)

:: clone repo if not exists
IF NOT EXIST medical (
  echo Cloning repository...
  git clone https://github.com/bmasmhj/medical.git
)

cd medical

:: install pnpm if missing
pnpm -v >nul 2>&1
IF ERRORLEVEL 1 (
  echo Installing pnpm...
  npm install -g pnpm
)

:: install dependencies
echo Installing dependencies...
pnpm install


:: install python venv if missing
python -m venv --help >nul 2>&1
IF ERRORLEVEL 1 (
  echo Python venv module not found!
  echo Please install Python 3.6+ with venv support first.
  pause
  exit /b
)

:: check if venv exists
IF NOT EXIST venv (
  echo Creating Python virtual environment...
  python -m venv venv
)

:: install python dependencies
echo Installing Python dependencies...
venv\Scripts\activate
pip install -r requirements.txt

:: run server
echo Starting server...
pnpm dev

pause
