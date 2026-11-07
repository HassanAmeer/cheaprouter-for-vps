#!/bin/bash
# Post-deploy smoke test for the live gateway (router.tokendeal.cloud)
set -uo pipefail

BASE=http://localhost:20128
PASS=$(grep -E '^INITIAL_PASSWORD=' /root/cheaprouter/.env | cut -d= -f2-)
CJ=/tmp/opencode/live-cookies.txt
rm -f "$CJ"

echo "=== 1. health ==="
curl -s --max-time 30 "$BASE/api/health"; echo

echo "=== 2. login ==="
curl -s --max-time 60 -c "$CJ" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"$PASS\"}" | head -c 200; echo

echo "=== 3. provider connection tests ==="
for id in conn-antseed-local dfa5237e-6b61-47cb-ae8d-a76128cc7d62 duckduckgo-web-free 9ea504c1-a1a4-46d6-8a41-f2b07d4dd867 da0c9432-995e-4497-8c3b-bf7d926706a6 kilocode-anonymous ap_kilocode-anonymous cline-anonymous opencode-free; do
  printf "%-40s " "$id"
  curl -s --max-time 45 -b "$CJ" -X POST "$BASE/api/providers/$id/test" \
    -H 'Content-Type: application/json' -d '{}' | head -c 220; echo
done

echo "=== 4. end-to-end chat via gateway key (model: claude-haiku-4-5, combo: auto) ==="
GKEY=$(sqlite3 /root/.cheaproute/storage.sqlite "SELECT key FROM api_keys WHERE is_active=1 AND revoked_at IS NULL AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) ORDER BY created_at DESC LIMIT 1")
for MODEL in "duckduckgo-web/claude-haiku-4-5" "auto" "Claude Haiku 4.5"; do
  printf "%-34s " "$MODEL"
  curl -s --max-time 60 -X POST "$BASE/v1/chat/completions" \
    -H "Authorization: Bearer $GKEY" -H 'Content-Type: application/json' \
    -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: OK\"}],\"max_tokens\":8}" | head -c 300; echo
done
