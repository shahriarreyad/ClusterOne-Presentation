#!/usr/bin/env bash
# nfs-check.sh — verify shared /home is mounted with the agreed options on every compute node (N7).
#
#   nfs-check.sh [MOUNTPOINT]     (default /home)
#
# Checks: mounted as nfs4, `hard`, vers=4.2, and a write/read round-trip works. `soft` is
# flagged as a failure: it turns a network blip into silent data corruption.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

MP="${1:-/home}"; bad=0
while read -r name ip; do
  opts="$(run_on "$ip" "findmnt -no FSTYPE,OPTIONS $MP" 2>/dev/null)"
  if [[ "$opts" != nfs4* ]]; then echo "FAIL $name: $MP is not an nfs4 mount ($opts)"; bad=1; continue; fi
  problems=""
  [[ "$opts" == *hard* ]]      || problems="$problems not-hard"
  [[ "$opts" == *soft* ]]      && problems="$problems SOFT"
  [[ "$opts" == *vers=4.2* ]]  || problems="$problems not-v4.2"
  probe="$MP/.clusterone-nfs-probe-$name-$$"
  run_on "$ip" "echo ok > $probe && [ \"\$(cat $probe)\" = ok ]; rc=\$?; rm -f $probe; exit \$rc" \
    || problems="$problems write-failed"
  if [[ -n "$problems" ]]; then echo "FAIL $name:$problems"; bad=1; else echo "ok   $name"; fi
done < <(nodes_list compute)
exit $bad
