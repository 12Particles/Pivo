#!/bin/bash

echo "Starting Pivo with RUST_LOG=debug to see all backend logs..."
echo "You should see logs like:"
echo "  - 'Starting Claude Code session for task: ...'"
echo "  - 'Sending input to session ...'"
echo "  - 'Using Claude session ID for resume: ...'"
echo ""

# Set RUST_LOG to debug level and run the dev server
RUST_LOG=debug pnpm tauri dev