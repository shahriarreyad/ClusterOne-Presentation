#!/usr/bin/env bash
# link-check.sh — negotiated speed, duplex, MTU and error counters per node (N1/N7).
#
#   link-check.sh [--min-speed MBPS]
#
# Flags: speed below --min-speed (default 10000), half duplex, MTU != 9000 on the fabric
# NIC, and non-zero rx/tx error counters. The fabric NIC is found by its 10.42.0.x address.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

MIN=10000
[[ "${1:-}" == "--min-speed" ]] && MIN="$2"

REMOTE='
IF=$(ip -4 -o addr show to 10.42.0.0/24 | awk "{print \$2}" | head -1)
[ -n "$IF" ] || { echo "NOIF"; exit 0; }
SPEED=$(cat /sys/class/net/$IF/speed 2>/dev/null || echo 0)
DUPLEX=$(cat /sys/class/net/$IF/duplex 2>/dev/null || echo unknown)
MTU=$(cat /sys/class/net/$IF/mtu)
ERR=$(( $(cat /sys/class/net/$IF/statistics/rx_errors) + $(cat /sys/class/net/$IF/statistics/tx_errors) ))
DROP=$(( $(cat /sys/class/net/$IF/statistics/rx_dropped) + $(cat /sys/class/net/$IF/statistics/tx_dropped) ))
echo "$IF $SPEED $DUPLEX $MTU $ERR $DROP"'

bad=0
printf '%-10s %-8s %-8s %-8s %-6s %-6s %s\n' NODE IFACE MBPS DUPLEX MTU ERRS DROPS
while read -r name ip; do
  out="$(run_on "$ip" "$REMOTE" 2>/dev/null)"
  if [[ -z "$out" || "$out" == NOIF ]]; then printf '%-10s unreachable or no fabric NIC\n' "$name"; bad=1; continue; fi
  read -r ifc spd dpx mtu err drop <<< "$out"
  flag=""
  (( spd < MIN )) && flag="$flag speed"
  [[ "$dpx" == full ]] || flag="$flag duplex"
  [[ "$mtu" == 9000 ]] || flag="$flag mtu"
  (( err > 0 )) && flag="$flag errors"
  printf '%-10s %-8s %-8s %-8s %-6s %-6s %-6s%s\n' "$name" "$ifc" "$spd" "$dpx" "$mtu" "$err" "$drop" "${flag:+  <-$flag}"
  [[ -n "$flag" ]] && bad=1
done < <(nodes_list)
exit $bad
