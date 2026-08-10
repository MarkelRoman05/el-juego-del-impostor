#!/bin/bash
# Auto-deploy script for El Impostor
# Called by webhook receiver on GitHub push events
set -e

PROJECT_DIR="/home/ubuntu/infraestructura/DESARROLLO/impostor"
INFRA_DIR="/home/ubuntu/infraestructura"
LOG_FILE="/home/ubuntu/.hermes/logs/impostor-deploy.log"
LOCK_FILE="/tmp/impostor-deploy.lock"

# Prevent concurrent deploys
if [ -f "$LOCK_FILE" ]; then
    echo "[$(date)] Deploy already in progress, skipping" >> "$LOG_FILE"
    exit 0
fi
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

echo "[$(date)] === Starting deploy ===" >> "$LOG_FILE"

cd "$PROJECT_DIR"

# Pull latest changes
echo "[$(date)] Pulling latest changes..." >> "$LOG_FILE"
cd "$PROJECT_DIR"
git pull origin main >> "$LOG_FILE" 2>&1

# Rebuild Docker image (Angular build happens inside Docker)
echo "[$(date)] Rebuilding Docker image..." >> "$LOG_FILE"
cd "$INFRA_DIR"
docker compose build impostor >> "$LOG_FILE" 2>&1

# Restart container
echo "[$(date)] Restarting container..." >> "$LOG_FILE"
docker compose up -d impostor >> "$LOG_FILE" 2>&1

# Purge Cloudflare cache
echo "[$(date)] Purging Cloudflare cache..." >> "$LOG_FILE"
CF_TOKEN=$(cat ~/infraestructura/cloudflare-api-token.txt | tr -d '\n')
ZONE_ID="3f7e81b915ad872cd2e2e4a274e6d70f"
PURGE_RESULT=$(curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')
if echo "$PURGE_RESULT" | grep -q '"success":true'; then
    echo "[$(date)] ✅ Cloudflare cache purged" >> "$LOG_FILE"
else
    echo "[$(date)] ⚠️ Cloudflare purge failed: $PURGE_RESULT" >> "$LOG_FILE"
fi

# Wait for health check
echo "[$(date)] Waiting for health check..." >> "$LOG_FILE"
sleep 5

# Verify
if curl -sf "https://impostor.markel05.me/healthz" > /dev/null 2>&1; then
    echo "[$(date)] ✅ Deploy successful - health check passed" >> "$LOG_FILE"
else
    echo "[$(date)] ❌ Deploy may have issues - health check failed" >> "$LOG_FILE"
fi

echo "[$(date)] === Deploy complete ===" >> "$LOG_FILE"
