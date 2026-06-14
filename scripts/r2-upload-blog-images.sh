#!/usr/bin/env bash
#
# One-shot: upload self-hosted blog images to a Cloudflare R2 bucket.
# Run ON THE VPS. Your R2 secret never has to leave the server.
#
# Prereqs (you do these once in the Cloudflare dashboard):
#   1. R2 → Enable.
#   2. Create a bucket (e.g. nepalfillings-images).
#   3. R2 → Manage API Tokens → create an "Object Read & Write" token.
#   4. (Recommended) Bucket → Settings → Custom Domains → add cdn.nepalfillings.com
#      so images serve CDN-cached at https://cdn.nepalfillings.com/blog-images/<file>.
#
# Then fill these in and run:  bash scripts/r2-upload-blog-images.sh
# ---------------------------------------------------------------------------
set -euo pipefail

R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"           # your Cloudflare account id
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"     # from the R2 API token
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_BUCKET="${R2_BUCKET:-nepalfillings-images}"
SRC_DIR="${SRC_DIR:-/root/nepsetradingemail/uploads/blog-images}"
DEST_PREFIX="blog-images"                     # keep prefix so the DB host-swap is trivial

for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
  [ -n "${!v}" ] || { echo "ERROR: $v is empty — set it in the environment first."; exit 1; }
done
[ -d "$SRC_DIR" ] || { echo "ERROR: source dir $SRC_DIR not found."; exit 1; }

# rclone is the simplest reliable R2/S3 client; install if missing.
if ! command -v rclone >/dev/null 2>&1; then
  echo "Installing rclone..."; curl -fsSL https://rclone.org/install.sh | bash
fi

# Ephemeral rclone config (deleted on exit so the secret isn't left on disk).
CFG="$(mktemp)"; trap 'rm -f "$CFG"' EXIT
cat > "$CFG" <<RCLONE
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
RCLONE

echo "Uploading $(find "$SRC_DIR" -type f | wc -l | tr -d ' ') files -> r2:${R2_BUCKET}/${DEST_PREFIX}/ ..."
rclone --config "$CFG" copy "$SRC_DIR/" "r2:${R2_BUCKET}/${DEST_PREFIX}/" \
  --transfers 8 --checksum --progress

echo ""
echo "Done. Objects now in the bucket:"
rclone --config "$CFG" size "r2:${R2_BUCKET}/${DEST_PREFIX}/"
echo ""
echo "Spot-check one object over the custom domain once it's connected, e.g.:"
echo "  curl -I https://cdn.nepalfillings.com/${DEST_PREFIX}/default.jpg"
