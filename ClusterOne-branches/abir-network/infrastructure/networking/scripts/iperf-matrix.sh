#!/usr/bin/env bash
# iperf-matrix.sh — all-pairs iperf3 bandwidth matrix, Gbit/s (N1.5 / N5 / N7).
#
#   iperf-matrix.sh [-t SECS] [-P STREAMS] [-o OUTFILE] [--min-gbps N]
#
# For every ordered pair (A→B) starts `iperf3 -s` on B, runs the client from A, and stops
# the server. Needs iperf3 on all nodes and key-based ssh. Port 5201 is closed by design:
# wrap this in `bench-fw.sh` to open it temporarily so you measure the REAL firewall.
# Raw JSON per pair goes to reports/raw/; a markdown matrix goes to OUTFILE.
# Exits 1 if any pair is below --min-gbps (default: no threshold).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

SECS=10; STREAMS=4; MIN=0; OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t) SECS="$2"; shift 2 ;; -P) STREAMS="$2"; shift 2 ;;
    -o) OUT="$2"; shift 2 ;; --min-gbps) MIN="$2"; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done
need jq
[[ -n "$OUT" ]] || OUT="$(report_path iperf-matrix)"
RAW="$REPORT_DIR/raw"; mkdir -p "$RAW"

NAMES=(); IPS=()
while read -r n i; do NAMES+=("$n"); IPS+=("$i"); done < <(nodes_list)
N=${#NAMES[@]}

RESULTS=()   # flat N*N array; bash 3.2 has no 2-D arrays
low=0
for ((a=0; a<N; a++)); do
  for ((b=0; b<N; b++)); do
    if [[ $a == "$b" ]]; then RESULTS[a*N+b]="—"; continue; fi
    run_on "${IPS[b]}" "pkill -x iperf3 2>/dev/null; iperf3 -s -D -1 >/dev/null 2>&1"
    sleep 1
    json="$RAW/iperf-${NAMES[a]}-to-${NAMES[b]}-$(stamp).json"
    run_on "${IPS[a]}" "iperf3 -c ${IPS[b]} -t $SECS -P $STREAMS -J" > "$json" 2>/dev/null
    gbps="$(jq -r '(.end.sum_received.bits_per_second // 0) / 1e9 | . * 100 | round / 100' "$json" 2>/dev/null || echo 0)"
    [[ -n "$gbps" ]] || gbps=0
    RESULTS[a*N+b]="$gbps"
    # awk does the float compare; bash can't
    if awk -v g="$gbps" -v m="$MIN" 'BEGIN{exit !(g < m)}'; then low=1; fi
    run_on "${IPS[b]}" "pkill -x iperf3 2>/dev/null; true"
  done
done

{
  echo "# iperf3 matrix — $(date -Is)"
  echo "Gbit/s, ${SECS}s, ${STREAMS} streams. Row = client, column = server."
  echo
  printf '| |'; for n in "${NAMES[@]}"; do printf ' %s |' "$n"; done; echo
  printf '|---|'; for ((k=0;k<N;k++)); do printf '%s' '---|'; done; echo
  for ((a=0; a<N; a++)); do
    printf '| **%s** |' "${NAMES[a]}"
    for ((b=0; b<N; b++)); do printf ' %s |' "${RESULTS[a*N+b]}"; done; echo
  done
} | tee "$OUT"
echo "saved: $OUT"
if [[ $low == 1 ]]; then echo "FAIL: at least one pair below $MIN Gbit/s" >&2; exit 1; fi
