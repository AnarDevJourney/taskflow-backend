#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# reset-demo-data.sh — wipe everything a portfolio visitor could have
# created/edited/deleted and restore the seeded demo state.
#
# This is a PRODUCTION-ONLY, public-demo tool. It intentionally
# destroys all data in the database, object storage and cache —
# never run it against a real deployment with real user data.
#
# Meant to run unattended on a schedule (see the cron line in
# README.md's "Live demo & data resets" section), but is safe to run
# by hand too — it always ends in the same known-good seeded state.
# ─────────────────────────────────────────────────────────────────
set -e

# Always run from the repo root, regardless of the caller's cwd (cron runs
# with no shell profile and an arbitrary/empty working directory).
cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.prod.yml"
NETWORK="taskflow-backend_taskflow-network"
MINIO_BUCKET="taskflow"

log() {
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] $1"
}

log "🔄 Starting demo data reset"

# ─── 1. Wipe the database ───────────────────────────────────────
# A full dropDatabase, not just re-running the seed script — the seed
# script only replaces its own seeded workspace/project by slug, it
# doesn't touch extra workspaces/users/tasks a visitor created.
log "🗑️  Dropping MongoDB database..."
docker exec taskflow-mongo mongosh taskflow --quiet --eval "db.dropDatabase()"

# ─── 2. Wipe uploaded files (attachments, avatars, logos) ──────
# The seed script never touches MinIO — any file a visitor uploaded
# has to be cleared separately. This removes every object but keeps
# the bucket itself (and the public/* read policy the API applies on
# boot), so nothing needs to be recreated on the MinIO side.
log "🗑️  Clearing MinIO bucket..."
docker run --rm --network "$NETWORK" \
  -e MINIO_ACCESS_KEY="$(grep '^MINIO_ACCESS_KEY=' .env.docker | cut -d= -f2)" \
  -e MINIO_SECRET_KEY="$(grep '^MINIO_SECRET_KEY=' .env.docker | cut -d= -f2)" \
  --entrypoint /bin/sh quay.io/minio/mc -c "
    mc alias set local http://minio:9000 \$MINIO_ACCESS_KEY \$MINIO_SECRET_KEY > /dev/null &&
    mc rm --recursive --force local/$MINIO_BUCKET/ > /dev/null 2>&1 || true
  "

# ─── 3. Flush Redis ──────────────────────────────────────────────
# Clears leftover BullMQ jobs and rate-limit counters. The API
# container restart below re-registers the due-date-scan scheduler
# (NotificationsScheduler upserts it on boot), so nothing is lost.
log "🗑️  Flushing Redis..."
docker exec taskflow-redis redis-cli FLUSHALL > /dev/null

# ─── 4. Restart the API ─────────────────────────────────────────
# Re-runs MinioService.ensureBucket() and re-registers the BullMQ
# job scheduler against the now-empty Redis.
log "🔁 Restarting API container..."
docker compose -f "$COMPOSE_FILE" restart taskflow-api

log "⏳ Waiting for API to become healthy..."
for i in $(seq 1 30); do
  status=$(docker inspect --format '{{.State.Health.Status}}' taskflow-api 2>/dev/null || echo "unknown")
  if [ "$status" = "healthy" ]; then
    break
  fi
  sleep 2
done

if [ "$status" != "healthy" ]; then
  log "❌ API did not become healthy in time — aborting before seeding."
  exit 1
fi

# ─── 5. Re-seed the demo data ───────────────────────────────────
log "🌱 Re-seeding demo data..."
docker exec taskflow-api npm run seed:docker

log "✅ Demo data reset complete."
