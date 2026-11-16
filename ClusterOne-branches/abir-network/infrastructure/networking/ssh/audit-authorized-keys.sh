#!/usr/bin/env bash
# audit-authorized-keys.sh — compare deployed authorized_keys against ssh/authorized/*.pub (N8).
#
#   audit-authorized-keys.sh [-u USER] [nodes.csv]
#
# Reports keys present on a node but NOT in the repo (unknown key = investigate) and repo
# keys missing on a node. Exit 1 on any unknown key. Run from the anchor.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUSER="${USER:-root}"
if [[ "${1:-}" == "-u" ]]; then RUSER="$2"; shift 2; fi
CSV="${1:-$HERE/../inventory/nodes.csv}"
KEYS="$HERE/authorized"

# compare on "type base64" only — comments differ between copies
norm() { awk '!/^#/ && NF>=2 {print $1, $2}' | sort -u; }

want="$(cat "$KEYS"/*.pub 2>/dev/null | norm || true)"
[[ -n "$want" ]] || { echo "no keys in $KEYS" >&2; exit 1; }

bad=0
while IFS=, read -r name ip _role; do
  [[ -z "$name" || "$name" == \#* || "$name" == shortname ]] && continue
  have="$(ssh -o BatchMode=yes -o ConnectTimeout=5 "$RUSER@$ip" 'cat ~/.ssh/authorized_keys 2>/dev/null' | norm)" \
    || { echo "!! $name: unreachable"; bad=1; continue; }
  unknown="$(comm -13 <(printf '%s\n' "$want") <(printf '%s\n' "$have"))"
  missing="$(comm -23 <(printf '%s\n' "$want") <(printf '%s\n' "$have"))"
  if [[ -n "$unknown" ]]; then echo "!! $name: UNKNOWN keys:"; printf '   %s\n' "$unknown"; bad=1; fi
  if [[ -n "$missing" ]]; then echo "?? $name: repo keys not deployed: $(printf '%s\n' "$missing" | wc -l | tr -d ' ')"; fi
  [[ -z "$unknown$missing" ]] && echo "ok $name"
done < "$CSV"
exit "$bad"
