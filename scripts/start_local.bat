@echo off
REM Startup script for local development (Windows)

echo ========================================
echo Gaze Tracking Experiment - Local Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.7+ and try again
    pause
    exit /b 1
)

REM Check if Flask is installed
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo Error: Flask is not installed
    echo Please run: pip install flask flask-cors
    pause
    exit /b 1
)

echo Starting Mock API Server on http://localhost:3000...
start "Mock API Server" python scripts\mock_api.py

timeout /t 2 /nobreak >nul

echo Starting Frontend Server on http://localhost:8000...
cd frontend
start "Frontend Server" python -m http.server 8000
cd ..

timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo Servers are running!
echo ========================================
echo.
echo Mock API:  http://localhost:3000
echo Frontend:  http://localhost:8000
echo.
echo Open http://localhost:8000 in your browser
echo.
echo Close the server windows to stop
echo ========================================
echo.
pause
