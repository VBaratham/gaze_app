#!/bin/bash
# Startup script for local development

echo "========================================"
echo "Gaze Tracking Experiment - Local Setup"
echo "========================================"
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if Flask is installed
if ! python3 -c "import flask" 2>/dev/null; then
    echo "Error: Flask is not installed"
    echo "Please run: pip install flask flask-cors"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $API_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Done!"
}

trap cleanup EXIT

# Start Mock API Server
echo "Starting Mock API Server on http://localhost:3000..."
cd "$PROJECT_ROOT"
python3 scripts/mock_api.py &
API_PID=$!

# Wait a moment for API to start
sleep 2

# Start Frontend Server
echo "Starting Frontend Server on http://localhost:8000..."
cd "$PROJECT_ROOT/frontend"
python3 -m http.server 8000 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 1

echo ""
echo "========================================"
echo "✓ Servers are running!"
echo "========================================"
echo ""
echo "Mock API:  http://localhost:3000"
echo "Frontend:  http://localhost:8000"
echo ""
echo "Open http://localhost:8000 in your browser"
echo ""
echo "Press Ctrl+C to stop all servers"
echo "========================================"

# Wait for user to press Ctrl+C
wait
