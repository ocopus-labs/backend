#!/bin/sh
set -e

echo "Running database migrations..."
MAX_RETRIES=30
RETRY_COUNT=0
SUCCESS=false

while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))

  if OUTPUT=$(npx prisma migrate deploy 2>&1); then
    echo "$OUTPUT"
    SUCCESS=true
    break
  fi

  echo "$OUTPUT"

  # P3009: a previous migration failed — mark it rolled-back so deploy can retry it
  FAILED=$(echo "$OUTPUT" | sed -n 's/.*The `\(.*\)` migration .* failed.*/\1/p')
  if [ -n "$FAILED" ]; then
    echo "Resolving failed migration: $FAILED"
    npx prisma migrate resolve --rolled-back "$FAILED" 2>&1 || true
  fi

  echo "--- Attempt ${RETRY_COUNT}/${MAX_RETRIES}. Retrying in 3s..."
  sleep 3
done

if [ "$SUCCESS" = "false" ]; then
  echo "ERROR: Migrations failed after ${MAX_RETRIES} attempts."
  exit 1
fi

echo "Migrations applied successfully."

if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  node dist/prisma/seed.js
fi

echo "Starting server..."
exec node dist/src/main
