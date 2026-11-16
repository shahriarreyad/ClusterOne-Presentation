#!/usr/bin/env bash
# audit-hardcoded-ips.sh — find literal fabric IPs where a name should be used (N6).
#
#   audit-hardcoded-ips.sh [DIR…]     (default: the repo root)
#
# Services must use gpuNN / anchor01 names so a renumbering is a one-file change. Literal
# 10.42.x.x is allowed in the network/infrastructure files that DEFINE addressing (below).
# Exit 1 if any offender is found.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
DIRS=("$@"); [[ ${#DIRS[@]} -gt 0 ]] || DIRS=("$ROOT")

hits="$(grep -rInE '10\.42\.[0-9]+\.[0-9]+' "${DIRS[@]}" \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.cache \
  --exclude-dir=abir-network-docs --exclude-dir=networking \
  --exclude='*.md' --exclude='*.lock' 2>/dev/null || true)"

if [[ -n "$hits" ]]; then
  echo "$hits"; echo; echo "FAIL: hard-coded fabric IPs above — use hostnames (…clusterone.internal)"; exit 1
fi
echo "PASS: no hard-coded fabric IPs outside infrastructure/networking"
