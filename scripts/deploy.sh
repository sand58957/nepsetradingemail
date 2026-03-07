#!/bin/bash
set -e

echo "========================================="
echo "  Deploying Listmonk to Production"
echo "========================================="

APP_DIR="/opt/listmonk"
REPO_URL="https://github.com/sand58957/nepsetradingemail.git"
BRANCH="master"

# Navigate to app directory
cd "$APP_DIR"

# Pull latest code
echo "[1/5] Pulling latest code..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Pull latest Docker images
echo "[2/5] Pulling latest Docker images..."
docker compose -f docker-compose.prod.yml pull

# Stop existing containers
echo "[3/5] Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

# Start containers
echo "[4/5] Starting containers..."
docker compose -f docker-compose.prod.yml up -d

# Clean up old images
echo "[5/5] Cleaning up old Docker images..."
docker image prune -f

echo "========================================="
echo "  Deployment Complete!"
echo "  App: https://nepalfillings.com"
echo "========================================="

# Show container status
docker compose -f docker-compose.prod.yml ps
