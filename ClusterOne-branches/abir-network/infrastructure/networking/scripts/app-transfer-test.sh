#!/usr/bin/env bash
# app-transfer-test.sh — real-file transfer rate node→node (N7). Catches what iperf can't:
# ssh crypto cost, disk, and checksum-verified integrity.
#
#   app-transfer-test.sh [-s SIZE_MB] SRC_IP DST_IP
#
# Creates a random file on SRC, copies it to DST with scp and rsync, compares sha256, and
# prints MB/s for each. Cleans up both files.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

SIZE=1024
[[ "${1:-}" == "-s" ]] && { SIZE="$2"; shift 2; }
[[ $# -eq 2 ]] || die "usage: $0 [-s SIZE_MB] SRC_IP DST_IP"
SRC="$1"; DST="$2"; F="/tmp/clusterone-xfer-$$"

cleanup() { run_on "$SRC" "rm -f $F" ; run_on "$DST" "rm -f $F.scp $F.rsync"; }
trap cleanup EXIT

run_on "$SRC" "dd if=/dev/urandom of=$F bs=1M count=$SIZE status=none" || die "cannot create test file on $SRC"
want="$(run_on "$SRC" "sha256sum $F | cut -d' ' -f1")"

for tool in scp rsync; do
  case $tool in
    scp)   cmd="scp -q -o StrictHostKeyChecking=yes $F $DST:$F.scp" ;;
    rsync) cmd="rsync -q -e 'ssh -o StrictHostKeyChecking=yes' $F $DST:$F.rsync" ;;
  esac
  t0=$(date +%s.%N)
  run_on "$SRC" "$cmd" || { echo "$tool: FAILED"; continue; }
  t1=$(date +%s.%N)
  got="$(run_on "$DST" "sha256sum $F.$tool | cut -d' ' -f1")"
  rate="$(awk -v s="$SIZE" -v a="$t0" -v b="$t1" 'BEGIN{printf "%.0f", s/(b-a)}')"
  [[ "$got" == "$want" ]] && echo "$tool: $rate MB/s, checksum ok" || echo "$tool: $rate MB/s, CHECKSUM MISMATCH"
done
