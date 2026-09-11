#!/usr/bin/env bash
#
# Deploy nepalfillings.com. Run ON THE VPS from /root/nepsetradingemail:
#
#   bash scripts/deploy.sh                 # backend + frontend
#   bash scripts/deploy.sh backend         # one service
#   bash scripts/deploy.sh --no-pull       # deploy what is already checked out
#
# About the nginx reload: nginx now resolves upstreams per request (default.conf
# uses Docker's resolver with variable proxy_pass), so a recreated container's
# new IP is picked up on its own and the old 502-until-reload failure cannot
# happen. The reload is kept as a safety net -- it also applies any nginx config
# change pulled in this deploy -- and it is cheap. The nginx -t gate before it
# means a bad config fails the deploy instead of taking the site down.
set -euo pipefail

cd "$(dirname "$0")/.."

PULL=1
SERVICES=()
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) SERVICES+=("$arg") ;;
  esac
done
[ ${#SERVICES[@]} -eq 0 ] && SERVICES=(backend frontend)

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

# This script rebuilds and restarts the production stack, so refuse to run
# anywhere but the deploy host. Without this guard, running it on a laptop
# points docker compose at whatever local stack shares the project name.
docker ps --format '{{.Names}}' 2>/dev/null | grep -qx nepse_nginx \
  || fail "nepse_nginx is not running here -- this is not the deploy host. Run this on the VPS from /root/nepsetradingemail."

if [ "$PULL" -eq 1 ]; then
  say "Pulling origin/main"
  git pull --ff-only origin main
fi
say "Deploying: ${SERVICES[*]} (at $(git rev-parse --short HEAD))"
docker compose up -d --build --no-deps "${SERVICES[@]}"

# Wait for each rebuilt service to report healthy before touching nginx, so the
# reload points at a container that can actually answer.
for svc in "${SERVICES[@]}"; do
  cid=$(docker compose ps -q "$svc" 2>/dev/null || true)
  [ -n "$cid" ] || { echo "  $svc: no container id, skipping health wait"; continue; }
  has_hc=$(docker inspect "$cid" --format '{{if .State.Health}}yes{{end}}' 2>/dev/null || true)
  if [ -z "$has_hc" ]; then
    echo "  $svc: no healthcheck defined, waiting 5s"; sleep 5; continue
  fi
  printf '  %s: waiting for healthy' "$svc"
  for _ in $(seq 1 60); do
    state=$(docker inspect "$cid" --format '{{.State.Health.Status}}' 2>/dev/null || echo unknown)
    [ "$state" = "healthy" ] && { printf ' ok\n'; break; }
    [ "$state" = "unhealthy" ] && { printf '\n'; fail "$svc became unhealthy"; }
    printf '.'; sleep 2
  done
  [ "$(docker inspect "$cid" --format '{{.State.Health.Status}}')" = "healthy" ] \
    || fail "$svc did not become healthy in time"
done

say "Reloading nginx so it re-resolves upstream container IPs"
docker exec nepse_nginx nginx -t   || fail "nginx config test failed; NOT reloading"
docker exec nepse_nginx nginx -s reload
sleep 3

say "Verifying"
rc=0
check() { # check <expected> <url> <label>
  code=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 25 "$2" || echo 000)
  if [ "$code" = "$1" ]; then printf '  ok   %-4s %s\n' "$code" "$3"
  else printf '  FAIL %-4s (want %s) %s\n' "$code" "$1" "$3"; rc=1; fi
}
check 200 "https://nepalfillings.com/api/health" "backend API"
check 200 "https://nepalfillings.com/"           "home"
check 200 "https://nepalfillings.com/blog"       "blog index"
check 200 "https://nepalfillings.com/robots.txt" "robots.txt"

body=$(curl -s --max-time 20 https://nepalfillings.com/api/health || true)
case "$body" in
  *'"status":"ok"'*) printf '  ok        backend reports status ok\n' ;;
  *) printf '  FAIL      backend health body: %s\n' "${body:-<empty>}"; rc=1 ;;
esac

[ "$rc" -eq 0 ] || fail "post-deploy checks did not pass"
say "Deployed $(git rev-parse --short HEAD) successfully"
