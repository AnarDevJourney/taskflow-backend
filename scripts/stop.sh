#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# stop.sh — stop TaskFlow backend (either mode)
# Asks which mode is currently running and stops the right one
# ─────────────────────────────────────────────────────────────────

echo "🛑 TaskFlow — stop containers"
echo ""
echo "Which mode is currently running?"
echo "  1) Development"
echo "  2) Production"
echo "  3) Both / not sure — stop everything"
echo ""
read -p "Choose [1/2/3]: " choice

case "$choice" in
  1)
    docker compose -f docker-compose.dev.yml down
    echo "✅ Development environment stopped."
    ;;
  2)
    docker compose -f docker-compose.prod.yml down
    echo "✅ Production environment stopped."
    ;;
  3)
    docker compose -f docker-compose.dev.yml down 2>/dev/null
    docker compose -f docker-compose.prod.yml down 2>/dev/null
    echo "✅ All TaskFlow containers stopped."
    ;;
  *)
    echo "❌ Invalid choice. Run the script again and choose 1, 2, or 3."
    exit 1
    ;;
esac

echo ""
echo "ℹ️  Your data is safe — named volumes (mongo-data, redis-data, minio-data) were not removed."
echo "   To wipe all data too, run: docker compose -f docker-compose.dev.yml down -v"