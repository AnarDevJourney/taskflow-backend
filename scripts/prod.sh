#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# prod.sh — start TaskFlow backend in PRODUCTION mode
# Compiled build, detached mode, uses docker-compose.prod.yml
# ─────────────────────────────────────────────────────────────────

set -e  # exit immediately if any command fails

echo "🚀 TaskFlow — starting in PRODUCTION mode"
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

# ─── Refuse to deploy with default/placeholder secrets ──────────
# The app itself also refuses to boot in production with these values
# (src/config/validation.schema.ts) — this just fails faster, before a
# docker build even starts. Keep both checks in sync.
if grep -q "replace-this-with" .env.docker; then
  echo "❌ .env.docker still contains placeholder JWT secrets."
  echo "   Replace JWT_SECRET and JWT_REFRESH_SECRET with real values before deploying"
  echo "   (e.g. openssl rand -hex 32 for each — they must also differ from each other)."
  exit 1
fi

if grep -qE "^MINIO_(ACCESS|SECRET)_KEY=minioadmin$" .env.docker; then
  echo "❌ .env.docker still uses the default MinIO credentials (minioadmin/minioadmin)."
  echo "   Set a real access key / secret key on the MinIO server and in .env.docker"
  echo "   before deploying (MINIO_ACCESS_KEY / MINIO_SECRET_KEY)."
  exit 1
fi

# ─── Start (detached) ────────────────────────────────────────────
echo "📦 Building and starting containers in the background..."
echo ""

docker compose -f docker-compose.prod.yml up --build -d

echo ""
echo "✅ TaskFlow is running in production mode."
echo ""
echo "   View status:   docker compose -f docker-compose.prod.yml ps"
echo "   View logs:     docker compose -f docker-compose.prod.yml logs -f taskflow-api"
echo "   Stop:          ./scripts/stop.sh"
echo ""
echo "   API:           http://localhost:3000/api/v1"
echo "   MinIO console: http://localhost:9001"