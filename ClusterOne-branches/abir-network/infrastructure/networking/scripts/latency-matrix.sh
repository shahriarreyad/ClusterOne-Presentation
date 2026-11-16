#!/usr/bin/env bash
# latency-matrix.sh — all-pairs ping RTT (avg ms) and loss (N1/N7).
#
#   latency-matrix.sh [-c COUNT] [--max-ms N]
#
# Run it idle for a baseline, then again under load (iperf-matrix.sh) to see queueing.
# Fails if any pair has loss or avg RTT above --max-ms (default 1.0 ms on a flat fabric).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

COUNT=20; MAX=1.0
while [[ $# -gt 0 ]]; do
  case "$1" in -c) COUNT="$2"; shift 2 ;; --max-ms) MAX="$2"; shift 2 ;; *) die "unknown option: $1" ;; esac
done

NAMES=(); IPS=()
while read -r n i; do NAMES+=("$n"); IPS+=("$i"); done < <(nodes_list)
N=${#NAMES[@]}; bad=0

printf '%-10s' "src\\dst"; for n in "${NAMES[@]}"; do printf '%-12s' "$n"; done; echo
for ((a=0; a<N; a++)); do
  printf '%-10s' "${NAMES[a]}"
  for ((b=0; b<N; b++)); do
    if [[ $a == "$b" ]]; then printf '%-12s' "-"; continue; fi
    out="$(run_on "${IPS[a]}" "ping -c $COUNT -i 0.2 -q ${IPS[b]} 2>&1")"
    loss="$(echo "$out" | sed -n 's/.* \([0-9.]*\)% packet loss.*/\1/p')"
    avg="$(echo "$out" | awk -F/ '/^rtt|^round-trip/ {print $5}')"
    if [[ -z "$avg" ]]; then printf '%-12s' "DOWN"; bad=1; continue; fi
    printf '%-12s' "${avg}ms/${loss}%"
    awk -v a="$avg" -v m="$MAX" -v l="${loss:-0}" 'BEGIN{exit !(a > m || l > 0)}' && bad=1
  done; echo
done
exit $bad
