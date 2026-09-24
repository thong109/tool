#!/bin/bash

echo "========================================"
echo "   FFmpeg Auto Installer for macOS/Linux"
echo "========================================"
echo ""

# Check if running on macOS or Linux
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

# Check for sudo privileges
echo "[1/5] Checking privileges..."
if [[ $OS == "macOS" ]]; then
    # Check if brew is installed
    if ! command -v brew &> /dev/null; then
        echo "ERROR: Homebrew is not installed!"
        echo "Please install Homebrew first: https://brew.sh/"
        exit 1
    fi
    echo "✓ Homebrew found"
else
    # Linux - check if running as root or has sudo
    if [[ $EUID -ne 0 ]]; then
        echo "ERROR: Please run this script with sudo!"
        echo "Usage: sudo ./install-ffmpeg.sh"
        exit 1
    fi
    echo "✓ Running as root"
fi
echo ""

echo "[2/5] Updating package lists..."
if [[ $OS == "macOS" ]]; then
    brew update
else
    apt update
fi
echo "✓ Package lists updated"
echo ""

echo "[3/5] Installing FFmpeg..."
if [[ $OS == "macOS" ]]; then
    brew install ffmpeg
else
    apt install -y ffmpeg
fi

if [ $? -ne 0 ]; then
    echo "ERROR: FFmpeg installation failed!"
    exit 1
fi
echo "✓ FFmpeg installed successfully"
echo ""

echo "[4/5] Verifying installation..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
    echo "✓ FFmpeg version: $FFMPEG_VERSION"
else
    echo "ERROR: FFmpeg not found in PATH!"
    exit 1
fi

if command -v ffprobe &> /dev/null; then
    FFPROBE_VERSION=$(ffprobe -version | head -n 1)
    echo "✓ FFprobe version: $FFPROBE_VERSION"
else
    echo "ERROR: FFprobe not found in PATH!"
    exit 1
fi
echo ""

echo "[5/5] Installation Summary..."
echo "========================================"
echo "   Installation Completed!"
echo "========================================"
echo ""
echo "FFmpeg has been installed successfully!"
echo ""
echo "You can now use FFmpeg. Try running:"
echo "  ffmpeg -version"
echo "  ffprobe -version"
echo ""
echo "Then restart your server:"
echo "  node server.js"
echo ""

exit 0