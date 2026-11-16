#!/usr/bin/env bash
# netcheck.sh — one-shot health check of the fabric from the anchor (N1/N2/N5).
#
#   netcheck.sh
#
# Per node: ping, DNS forward, DNS reverse, SSH, clock offset. Exit 1 if anything fails,
# so it doubles as a CI/cron gate. Uses the anchor's resolver — run it ON the anchor.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"
need ping getent

bad=0
printf '%-10s %-6s %-6s %-6s %-6s %s\n' NODE PING DNS RDNS SSH CLOCK
while read -r name ip; do
  ping -c1 -W2 "$ip" >/dev/null 2>&1 && p=ok || { p=FAIL; bad=1; }
  fw="$(getent hosts "$name.$DOMAIN" | awk '{print $1}')"
  [[ "$fw" == "$ip" ]] && d=ok || { d=FAIL; bad=1; }
  rv="$(getent hosts "$ip" | awk '{print $2}')"
  [[ "$rv" == "$name.$DOMAIN" ]] && r=ok || { r=FAIL; bad=1; }
  # shellcheck disable=SC2086
  if ssh $SSH_OPTS "$ip" true 2>/dev/null; then s=ok; else s=FAIL; bad=1; fi
  # chronyc offset of the node vs. anchor, in ms
  # shellcheck disable=SC2086
  off="$(ssh $SSH_OPTS "$ip" "chronyc tracking 2>/dev/null | awk '/Last offset/ {printf \"%.1fms\", \$4*1000}'" 2>/dev/null)"
  printf '%-10s %-6s %-6s %-6s %-6s %s\n' "$name" "$p" "$d" "$r" "$s" "${off:-n/a}"
done < <(nodes_list)
exit $bad
