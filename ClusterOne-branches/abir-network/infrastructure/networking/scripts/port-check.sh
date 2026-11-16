#!/usr/bin/env bash
# port-check.sh — verify the firewall against firewall/port-matrix.tsv (N4.6 / N5).
#
#   port-check.sh [-m MATRIX] [--strict] [--sw01 IP]
#
# Run from the anchor (needs key-based ssh to the nodes). For every matrix row it probes
# from the stated source host to the stated target.
#
# How a result is read (this is what makes it valid BEFORE services exist):
#   connect ok / connection REFUSED  → the packet got through the firewall (a RST came back)
#   TIMEOUT                          → the firewall dropped it
#   open    rows pass on ok|refused;  blocked rows pass ONLY on timeout.
# A closed-but-allowed port therefore passes an "open" row and a listening-but-allowed port
# fails a "blocked" row — exactly the distinction that matters.
#
# Rows with status `tbc` only warn, unless --strict. Exit 1 on any hard failure.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

MATRIX="$NET_ROOT/firewall/port-matrix.tsv"
STRICT=0; SW01=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m) MATRIX="$2"; shift 2 ;;
    --strict) STRICT=1; shift ;;
    --sw01) SW01="$2"; shift 2 ;;
    *) die "unknown option: $1" ;;
  esac
done
[[ -r "$MATRIX" ]] || die "cannot read $MATRIX"

COMPUTE=(); while read -r n i; do COMPUTE+=("$n $i"); done < <(nodes_list compute)
[[ ${#COMPUTE[@]} -ge 2 ]] || die "need at least 2 compute nodes in $NODES_CSV"

# probe SRC_IP DST_IP PORT → prints ok | refused | timeout
probe() {
  local rc
  run_on "$1" "timeout 3 bash -c '</dev/tcp/$2/$3' 2>/dev/null"; rc=$?
  case $rc in 0) echo ok ;; 124) echo timeout ;; 255) echo sshfail ;; *) echo refused ;; esac
}

# expand "80,443,1000-3000" → ports (ranges sampled: first, middle, last)
expand_ports() {
  local tok lo hi
  for tok in ${1//,/ }; do
    if [[ "$tok" == *-* ]]; then lo="${tok%-*}"; hi="${tok#*-}"; echo "$lo $(( (lo+hi)/2 )) $hi"
    else echo "$tok"; fi
  done | tr ' ' '\n'
}

pass=0; fail=0; warnn=0
while IFS=$'\t' read -r id from to _proto ports expect status _owner _note; do
  [[ -z "$id" || "$id" == \#* ]] && continue

  # build (src, dst) pairs
  pairs=()
  case "$from:$to" in
    anchor:compute) for c in "${COMPUTE[@]}"; do pairs+=("local ${c#* }"); done ;;
    compute:anchor) for c in "${COMPUTE[@]}"; do pairs+=("${c#* } $ANCHOR_IP"); done ;;
    compute:peer)   # a ring: each node probes its successor, so every node is source and target once
      n=${#COMPUTE[@]}
      for ((k=0; k<n; k++)); do pairs+=("${COMPUTE[k]#* } ${COMPUTE[(k+1)%n]#* }"); done ;;
    compute:sw01)
      [[ -n "$SW01" ]] || { echo "SKIP $id (pass --sw01 IP to test the switch)"; continue; }
      for c in "${COMPUTE[@]}"; do pairs+=("${c#* } $SW01"); done ;;
    *) warn "row $id: unsupported $from:$to"; continue ;;
  esac

  for pair in "${pairs[@]}"; do
    src="${pair% *}"; dst="${pair#* }"
    for port in $(expand_ports "$ports"); do
      got="$(probe "$src" "$dst" "$port")"
      ok=0
      if [[ "$got" == sshfail ]]; then ok=2
      elif [[ "$expect" == open    && ( "$got" == ok || "$got" == refused ) ]]; then ok=1
      elif [[ "$expect" == blocked && "$got" == timeout ]]; then ok=1; fi

      if [[ $ok == 1 ]]; then pass=$((pass+1)); continue; fi
      msg="$id: $src → $dst:$port expected $expect, got $got"
      if [[ "$status" == tbc && $STRICT == 0 ]]; then echo "WARN $msg (port TBC)"; warnn=$((warnn+1))
      else echo "FAIL $msg"; fail=$((fail+1)); fi
    done
  done
done < "$MATRIX"

echo "port-check: $pass passed, $fail failed, $warnn warnings"
[[ $fail -eq 0 ]]
