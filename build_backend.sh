#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define paths
BACKEND_DIR="backend"
MAIN_SCRIPT="main.py"
OUTPUT_DIR="../resources/api"

# Navigate to the backend directory
cd "$BACKEND_DIR"

# Create the output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Clean previous PyInstaller build artifacts
rm -rf "dist" "build"

# Clean previous build artifacts
source "venv/bin/activate"
pyinstaller --clean "$MAIN_SCRIPT"

pyinstaller \
    --onefile \
    --name localdev-api \
    --distpath "$OUTPUT_DIR" \
    --hidden-import="ollama" \
    --hidden-import="lancedb" \
    "$MAIN_SCRIPT"
deactivate

# Navigate back to the original directory
cd -

echo "Backend build complete! Executable located at $OUTPUT_DIR/localdev-api"
