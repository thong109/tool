#!/bin/bash

echo "========================================"
echo "   MKT Software - Complete Setup"
echo "========================================"
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
else
    echo "ERROR: Unsupported operating system: $OSTYPE"
    exit 1
fi

echo "Detected OS: $OS"
echo ""

echo "This script will:"
echo "  1. Install Node.js dependencies"
echo "  2. Install FFmpeg automatically"
echo "  3. Verify installation"
echo ""

# Check for sudo/root privileges
echo "[Step 1/3] Installing Node.js dependencies..."
echo ""

if [[ -d "node_modules" ]]; then
    echo "✓ node_modules already exists"
    echo "Checking for updates..."
    npm update
else
    echo "node_modules not found. Running npm install..."
    npm install
fi

if [ $? -ne 0 ]; then
    echo "ERROR: npm install failed!"
    exit 1
fi

echo "✓ Node.js dependencies installed"
echo ""

echo "[Step 2/3] Installing FFmpeg..."
echo ""

# Check if FFmpeg is already installed
if command -v ffmpeg &> /dev/null; then
    echo "✓ FFmpeg is already installed!"
    ffmpeg -version | head -n 1
    echo ""
    echo "Skipping FFmpeg installation..."
else
    echo "FFmpeg not found. Starting installation..."
    echo ""
    
    # Check if install-ffmpeg.sh exists
    if [[ ! -f "install-ffmpeg.sh" ]]; then
        echo "ERROR: install-ffmpeg.sh not found!"
        echo "Please make sure you're running this from the project directory."
        exit 1
    fi
    
    # Make script executable
    chmod +x install-ffmpeg.sh
    
    # Run FFmpeg installer
    if [[ $OS == "Linux" ]]; then
        sudo ./install-ffmpeg.sh
    else
        ./install-ffmpeg.sh
    fi
    
    if [ $? -ne 0 ]; then
        echo "ERROR: FFmpeg installation failed!"
        exit 1
    fi
fi

echo ""
echo "[Step 3/3] Verifying installation..."
echo ""

echo "Checking Node.js..."
if command -v node &> /dev/null; then
    node --version
    echo "✓ Node.js is installed"
else
    echo "ERROR: Node.js is not installed!"
    exit 1
fi
echo ""

echo "Checking npm..."
if command -v npm &> /dev/null; then
    npm --version
    echo "✓ npm is installed"
else
    echo "ERROR: npm is not installed!"
    exit 1
fi
echo ""

echo "Checking FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    ffmpeg -version | head -n 1
    echo "✓ FFmpeg is installed"
else
    echo "WARNING: FFmpeg not found in PATH"
    echo "You may need to restart your terminal"
fi
echo ""

echo "Checking FFprobe..."
if command -v ffprobe &> /dev/null; then
    ffprobe -version | head -n 1
    echo "✓ FFprobe is installed"
else
    echo "WARNING: FFprobe not found in PATH"
fi
echo ""

echo "========================================"
echo "   Setup Completed!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Restart your terminal (if FFmpeg was just installed)"
echo "  2. Run: node server.js"
echo "  3. Open: http://localhost:3000/video-cutter-wasm.html"
echo ""
echo "For more information, see HOW_TO_RUN.md"
echo ""

exit 0