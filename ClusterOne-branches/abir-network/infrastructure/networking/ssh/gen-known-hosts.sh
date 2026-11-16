#!/usr/bin/env bash
# gen-known-hosts.sh — build /etc/ssh/ssh_known_hosts for the whole cluster (N3).
#
#   gen-known-hosts.sh [-o FILE] [nodes.csv]
#
# Scans each node's host keys so every host trusts every other with StrictHostKeyChecking
# ON (no blind "yes" prompts, and a changed key is a loud error). Run from the anchor while
# the fabric is trusted (i.e. right after provisioning), then diff before replacing an
# existing file: an unexpected key change is a security event, not a nuisance.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="/etc/ssh/ssh_known_hosts"
if [[ "${1:-}" == "-o" ]]; then OUT="$2"; shift 2; fi
CSV="${1:-$HERE/../inventory/nodes.csv}"
DOMAIN="clusterone.internal"

command -v ssh-keyscan >/dev/null || { echo "ssh-keyscan not found" >&2; exit 1; }
[[ -r "$CSV" ]] || { echo "cannot read $CSV" >&2; exit 1; }

tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
fail=0
while IFS=, read -r name ip _role; do
  [[ -z "$name" || "$name" == \#* || "$name" == shortname ]] && continue
  if ! out="$(ssh-keyscan -T 5 -t ed25519,rsa "$ip" 2>/dev/null)" || [[ -z "$out" ]]; then
    echo "warn: no host keys from $name ($ip)" >&2; fail=1; continue
  fi
  # rewrite the host field so the key matches short name, FQDN and IP
  printf '%s\n' "$out" | awk -v h="$name,$name.$DOMAIN,$ip" '!/^#/ {print h, $2, $3}' >> "$tmp"
done < "$CSV"

[[ -s "$tmp" ]] || { echo "no keys collected — not writing $OUT" >&2; exit 1; }
if [[ -f "$OUT" ]] && ! diff -q "$OUT" "$tmp" >/dev/null; then
  echo "note: $OUT changes:"; diff "$OUT" "$tmp" || true
fi
install -D -m 0644 "$tmp" "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') keys)"
exit "$fail"
