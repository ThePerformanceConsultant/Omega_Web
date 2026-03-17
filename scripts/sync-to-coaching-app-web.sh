#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SOURCE="${REPO_ROOT}/"
TARGET="/Users/willdyson/Documents/Coaching/Coaching App/web/"

if [[ ! -d "${TARGET}" ]]; then
  echo "Target web mirror path not found: ${TARGET}" >&2
  exit 1
fi

cd "${REPO_ROOT}"

echo "[1/4] Verifying production build in Omega_Web..."
npm run build

echo "[2/4] Mirroring Omega_Web -> Coaching App/web..."
rsync -a --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'supabase' \
  "${SOURCE}" "${TARGET}"

echo "[3/4] Verifying parity..."
PARITY_DIFF="$(
  rsync -a --delete --checksum --dry-run --itemize-changes \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'supabase' \
    "${SOURCE}" "${TARGET}" \
    | awk '$1 != ".d..t...." {print}'
)"

if [[ -n "${PARITY_DIFF}" ]]; then
  echo "SYNC_FAILED: mirror mismatch detected after sync." >&2
  echo "${PARITY_DIFF}" >&2
  exit 1
fi

echo "[4/4] Done."
echo "SYNC_OK: Coaching App/web is in parity with Omega_Web"
