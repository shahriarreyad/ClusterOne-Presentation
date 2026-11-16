#!/usr/bin/env bash
# tuning-ab.sh — A/B test the N7 network sysctl profile, with automatic revert (N7).
#
#   tuning-ab.sh SRC_IP DST_IP
#
# Measures iperf3 (4 streams, 10 s) DST←SRC on the CURRENT settings, applies
# sysctl/99-clusterone-net.conf on both hosts, measures again, then prints the delta.
# Reverts to the previous values on exit unless KEEP=1 — tuning must justify itself with a
# number before it is kept (then deploy it via the Ansible `tuning` play).
# Needs 5201 open: run it under `bench-fw.sh --`.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"
need jq

[[ $# -eq 2 ]] || die "usage: $0 SRC_IP DST_IP"
SRC="$1"; DST="$2"
CONF="$NET_ROOT/sysctl/99-clusterone-net.conf"
[[ -r "$CONF" ]] || die "missing $CONF"

KEYS="$(awk -F= '!/^#/ && NF==2 {gsub(/ /,"",$1); print $1}' "$CONF")"

measure() {
  run_on "$DST" "pkill -x iperf3 2>/dev/null; iperf3 -s -D -1 >/dev/null 2>&1"; sleep 1
  run_on "$SRC" "iperf3 -c $DST -t 10 -P 4 -J" | jq -r '(.end.sum_received.bits_per_second // 0)/1e9 | . * 100 | round / 100'
  run_on "$DST" "pkill -x iperf3 2>/dev/null; true"
}

# snapshot current values on both hosts so we can restore them
snap() { local k; for k in $KEYS; do echo "$k=$(run_on "$1" "sysctl -n $k" 2>/dev/null)"; done; }
S_SRC="$(snap "$SRC")"; S_DST="$(snap "$DST")"

restore() {
  [[ "${KEEP:-0}" == 1 ]] && { echo "KEEP=1: leaving tuned values in place"; return; }
  echo "reverting sysctls…"
  local l
  while IFS= read -r l; do [[ -n "$l" ]] && run_on "$SRC" "sudo sysctl -qw '$l'" ; done <<< "$S_SRC"
  while IFS= read -r l; do [[ -n "$l" ]] && run_on "$DST" "sudo sysctl -qw '$l'" ; done <<< "$S_DST"
}
trap restore EXIT

before="$(measure)"; echo "before: ${before} Gbit/s"
for h in "$SRC" "$DST"; do
  grep -v '^#' "$CONF" | grep '=' | while IFS= read -r l; do run_on "$h" "sudo sysctl -qw '$l'" 2>/dev/null; done
done
after="$(measure)";  echo "after:  ${after} Gbit/s"
awk -v b="$before" -v a="$after" 'BEGIN{ if (b>0) printf "delta:  %+.1f%%\n", (a-b)/b*100 }'
