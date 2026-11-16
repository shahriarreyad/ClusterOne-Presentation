#!/usr/bin/env bash
# bench-fw.sh — run a command with iperf3 (5201) temporarily open on every node's firewall.
#
#   bench-fw.sh -- scripts/iperf-matrix.sh -t 10
#
# 5201 is deliberately closed in the permanent ruleset. This inserts an accept into the
# EMPTY `bench` chain on all nodes (so the measurement runs through the real firewall,
# not with it off), runs your command, and ALWAYS removes the rule on exit — even on Ctrl-C.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

[[ "${1:-}" == "--" ]] && shift
[[ $# -gt 0 ]] || die "usage: $0 -- COMMAND [ARGS…]"

OPEN='sudo nft add rule inet clusterone bench accept comment \"bench-fw\"'
CLOSE='sudo nft flush chain inet clusterone bench'

close_all() {
  echo "bench-fw: closing 5201 everywhere" >&2
  while read -r _ ip; do run_on "$ip" "$CLOSE" >/dev/null 2>&1; done < <(nodes_list)
}
trap close_all EXIT INT TERM

while read -r name ip; do
  run_on "$ip" "$OPEN" || die "cannot open bench chain on $name (is the clusterone table loaded?)"
done < <(nodes_list)
echo "bench-fw: 5201 open on all nodes"
"$@"
