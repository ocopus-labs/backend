#!/bin/sh
set -e

# Wait for database to be ready (important for Coolify where there's no depends_on)
echo "Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0
until npx prisma migrate deploy 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Database not reachable after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi
  echo "Database not ready yet (attempt ${RETRY_COUNT}/${MAX_RETRIES}). Retrying in 2s..."
  sleep 2
done
echo "Migrations applied successfully."

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  node dist/prisma/seed.js
fi

echo "Starting server..."
exec node dist/src/main
