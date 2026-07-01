#!/bin/bash

echo "========================================"
echo "   MKT Software - Starting Server"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[OK] Node.js found: $(node --version)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies..."
    npm install
    echo ""
fi

echo "[INFO] Starting server..."
echo ""
echo "Server will run at: http://localhost:3000"
echo "Press Ctrl+C to stop"
echo ""

node server.js