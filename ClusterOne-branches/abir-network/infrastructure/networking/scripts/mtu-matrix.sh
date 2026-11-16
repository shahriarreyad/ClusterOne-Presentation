#!/usr/bin/env bash
# mtu-matrix.sh — prove jumbo frames work end-to-end between every node pair (N1/N7).
#
#   mtu-matrix.sh [-s PAYLOAD]
#
# `ping -M do -s 8972` = a 9000-byte packet with Don't-Fragment. If any hop is at 1500 the
# ping fails, so a wrong MTU on a NIC or a switch port shows up here, not as mysterious NCCL
# slowness. 8972 = 9000 - 20 (IP) - 8 (ICMP).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

PAYLOAD=8972
[[ "${1:-}" == "-s" ]] && PAYLOAD="$2"

NAMES=(); IPS=()
while read -r n i; do NAMES+=("$n"); IPS+=("$i"); done < <(nodes_list)
N=${#NAMES[@]}; bad=0

printf '%-10s' "src\\dst"; for n in "${NAMES[@]}"; do printf '%-9s' "$n"; done; echo
for ((a=0; a<N; a++)); do
  printf '%-10s' "${NAMES[a]}"
  for ((b=0; b<N; b++)); do
    if [[ $a == "$b" ]]; then printf '%-9s' "-"; continue; fi
    if run_on "${IPS[a]}" "ping -c2 -W2 -M do -s $PAYLOAD ${IPS[b]} >/dev/null 2>&1"; then printf '%-9s' ok
    else printf '%-9s' FAIL; bad=1; fi
  done; echo
done
[[ $bad == 0 ]] && echo "jumbo path OK ($PAYLOAD-byte DF pings)" || echo "FAIL: some pairs cannot pass $((PAYLOAD+28))-byte frames" >&2
exit $bad
