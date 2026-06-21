#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# dev.sh — start TaskFlow backend in DEVELOPMENT mode
# Runs all containers detached, then auto-opens a new terminal
# window tailing the API logs.
# ─────────────────────────────────────────────────────────────────

set -e

echo "🔧 TaskFlow — starting in DEVELOPMENT mode"
echo ""

# ─── Check Docker is running ────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# ─── Check .env.docker exists ───────────────────────────────────
if [ ! -f .env.docker ]; then
  echo "❌ .env.docker not found in project root."
  echo "   Create it before running this script — see README for the template."
  exit 1
fi

# ─── Start everything detached ──────────────────────────────────
echo "📦 Building and starting containers (mongo, redis, minio, api)..."
echo ""

docker compose -f docker-compose.dev.yml up --build -d

echo ""
echo "✅ Containers are up. Opening log window..."
echo ""

# ─── Auto-open a new terminal window tailing API logs ───────────
LOG_CMD="docker compose -f docker-compose.dev.yml logs -f taskflow-api"
PROJECT_DIR="$(pwd)"

if command -v gnome-terminal &> /dev/null; then
  gnome-terminal -- bash -c "cd '$PROJECT_DIR' && $LOG_CMD; exec bash"
elif command -v konsole &> /dev/null; then
  konsole -e bash -c "cd '$PROJECT_DIR' && $LOG_CMD; exec bash" &
elif command -v xterm &> /dev/null; then
  xterm -e bash -c "cd '$PROJECT_DIR' && $LOG_CMD; exec bash" &
elif command -v osascript &> /dev/null; then
  # macOS — opens a new Terminal.app window
  osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR' && $LOG_CMD\""
else
  echo "⚠️  Could not auto-detect your terminal emulator."
  echo "   Open a new terminal manually and run:"
  echo "   $LOG_CMD"
  echo ""
fi

echo "ℹ️  Containers are running in the background."
echo "   This terminal is free — use it for git, editing, etc."
echo "   Logs are streaming in the new window."
echo ""
echo "   Stop everything with: ./scripts/stop.sh"