#!/usr/bin/env bash
# ddp-debug-checklist.sh — automated first pass when multi-node training hangs or crawls (N7).
#
#   ddp-debug-checklist.sh
#
# Runs the checks in the order they usually find the cause: reachability, MTU, clocks,
# firewall rendezvous ports, NCCL env, listening sockets, NIC errors. Each prints PASS/FAIL
# with the fix hint; read the FAILs top-down.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

step() { printf '\n== %s\n' "$1"; }
res()  { if [[ "$1" == 0 ]]; then echo "PASS  $2"; else echo "FAIL  $2  → $3"; fi; }

step "1. every node answers ping"
while read -r n ip; do ping -c1 -W2 "$ip" >/dev/null 2>&1; res $? "$n" "check cable / link-check.sh"; done < <(nodes_list compute)

step "2. jumbo frames pass between all pairs"
"$HERE/mtu-matrix.sh" >/dev/null 2>&1; res $? "mtu-matrix" "a NIC or switch port is still at 1500 — hangs at large all-reduce messages"

step "3. clocks agree (<50 ms)"
while read -r n ip; do
  off="$(run_on "$ip" "chronyc tracking | awk '/System time/ {print \$4}'" 2>/dev/null)"
  awk -v o="${off:-9}" 'BEGIN{exit !(o < 0.05)}'; res $? "$n offset=${off:-?}s" "chrony not synced to the anchor"
done < <(nodes_list compute)

step "4. rendezvous port (29400) reachable through the firewall"
first="$(nodes_list compute | head -1 | awk '{print $2}')"
while read -r n ip; do
  [[ "$ip" == "$first" ]] && continue
  run_on "$ip" "timeout 3 bash -c '</dev/tcp/$first/29400' 2>/dev/null"; rc=$?
  [[ $rc == 124 ]] && res 1 "$n → $first:29400 (timeout)" "nft dropped it — check compute.nft 29400-29600" || res 0 "$n → $first:29400 (rc=$rc: not filtered)"
done < <(nodes_list compute)

step "5. NCCL env on nodes"
while read -r n ip; do
  v="$(run_on "$ip" "bash -lc 'echo \$NCCL_SOCKET_IFNAME'" 2>/dev/null)"
  [[ -n "$v" ]]; res $? "$n NCCL_SOCKET_IFNAME=${v:-unset}" "profile.d/clusterone-nccl.sh not installed — NCCL may pick the campus NIC"
done < <(nodes_list compute)

step "6. NIC error counters"
"$HERE/link-check.sh" >/dev/null 2>&1; res $? "link-check" "run scripts/link-check.sh for details (speed/duplex/errors)"

echo; echo "Next: NCCL_DEBUG=INFO on a 2-node run and look for 'NET/Socket : Using [0]<iface>' — it must be the fabric NIC."
