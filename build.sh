#!/bin/bash

# This script builds the on-cleanup.ts file into a non-minified and a minified version.
# It uses esbuild, so make sure you have it installed (e.g., npm install -g esbuild).

# Exit on error
set -e

# Create dist directory if it doesn't exist
mkdir -p dist

# Get the directory of the script
SCRIPT_DIR=$(dirname "$0")

# Change to the script's directory to resolve paths correctly
cd "$SCRIPT_DIR"

# Build non-minified version
echo "Building non-minified version..."
esbuild on-cleanup.ts --bundle --format=esm --target=es2021 --outfile=dist/on-cleanup.js --tsconfig=tsconfig.json

# Build minified version
echo "Building minified version..."
esbuild on-cleanup.ts --bundle --format=esm --target=es2021 --minify --outfile=dist/on-cleanup.min.js --tsconfig=tsconfig.json

echo "Build complete!"
echo "  dist/on-cleanup.js      (non-minified)"
echo "  dist/on-cleanup.min.js  (minified)"
