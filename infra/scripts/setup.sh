#!/bin/bash
set -e

echo "=========================================="
echo " Starting Hefesto/Hefesto Infra"
echo "=========================================="

# Ensure we are at the project root
cd "$(dirname "$0")/../.."

# Start the docker containers
echo "[1/4] Starting Docker Compose..."
docker compose -f infra/docker-compose.yml up -d

# Wait for PostgreSQL
echo "[2/4] Waiting for PostgreSQL..."
RETRIES=30
until docker exec $(docker compose -f infra/docker-compose.yml ps -q postgres 2>/dev/null || docker compose -f infra/docker-compose.yml ps -q db) pg_isready -U hefesto 2>/dev/null; do
  sleep 2
  RETRIES=$((RETRIES-1))
  if [ $RETRIES -le 0 ]; then
    echo "Error: PostgreSQL did not become ready in time."
    exit 1
  fi
done

# Wait for Redis (optional, usually fast)
echo "[3/4] Waiting for Redis..."
sleep 2

# Run migrations
echo "[4/4] Running database migrations..."
if [ -d "apps/api" ]; then
  cd apps/api
  npm run db:push || echo "Warning: Migration command failed or not defined. Please check package.json."
  cd ../..
fi

echo "=========================================="
echo " Infrastructure setup complete!"
echo "=========================================="
