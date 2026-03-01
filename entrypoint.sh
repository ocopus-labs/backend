#!/bin/sh
set -e

echo "Waiting for database..."
MAX_RETRIES=30
RETRY_COUNT=0

until npx prisma migrate deploy 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Could not run migrations after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi
  echo "--- Attempt ${RETRY_COUNT}/${MAX_RETRIES} failed. Retrying in 3s..."
  sleep 3
done
echo "Migrations applied successfully."

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  node dist/prisma/seed.js
fi

echo "Starting server..."
exec node dist/src/main
