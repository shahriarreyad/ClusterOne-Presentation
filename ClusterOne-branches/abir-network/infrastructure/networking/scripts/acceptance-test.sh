#!/usr/bin/env bash
# acceptance-test.sh — the N9 sign-off: run every automated network check, one verdict.
#
#   acceptance-test.sh [--skip-perf] [--min-gbps N]
#
# Run on the anchor. Each check is PASS/FAIL; a report is written to reports/. The physical
# and human items from the N9 checklist (labels, cable map, runbook drill) stay manual and
# are printed at the end so they are not forgotten.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

PERF=1; MINGBPS=8
while [[ $# -gt 0 ]]; do
  case "$1" in --skip-perf) PERF=0; shift ;; --min-gbps) MINGBPS="$2"; shift 2 ;; *) die "unknown option: $1" ;; esac
done
REPORT="$(report_path acceptance)"
fails=0

check() {   # check "name" cmd…
  local name="$1"; shift
  if "$@" >/tmp/acc.$$ 2>&1; then echo "PASS  $name"; else echo "FAIL  $name"; sed 's/^/        /' /tmp/acc.$$ | tail -8; fails=$((fails+1)); fi
  rm -f /tmp/acc.$$
}

{
  echo "# Network acceptance — $(date -Is) — $(hostname)"; echo; echo '```'
  check "inventory valid"                 "$HERE/inventory-validate.sh"
  check "reachability, DNS, SSH, clock"   "$HERE/netcheck.sh"
  check "link speed/duplex/MTU/errors"    "$HERE/link-check.sh"
  check "jumbo path (all pairs)"          "$HERE/mtu-matrix.sh"
  check "latency (all pairs)"             "$HERE/latency-matrix.sh" -c 10
  check "firewall matches port matrix"    "$HERE/port-check.sh"
  check "no hard-coded fabric IPs"        "$HERE/audit-hardcoded-ips.sh"
  check "NFS mounts sane"                 "$HERE/nfs-check.sh"
  if [[ $PERF == 1 ]]; then
    check "iperf3 ≥ ${MINGBPS} Gbit/s all pairs" "$HERE/bench-fw.sh" -- "$HERE/iperf-matrix.sh" -t 5 --min-gbps "$MINGBPS"
  fi
  echo '```'; echo
  if [[ $fails -eq 0 ]]; then echo "**RESULT: PASS**"; else echo "**RESULT: FAIL ($fails checks)**"; fi
  cat <<'EOF'

Manual N9 items (not automatable): cables and ports labelled to match `inventory/cable-map.md`;
switch config exported to `switch/backups/`; runbook drill (unplug a node, follow the runbook);
external scan from campus with `scripts/scan-verify.sh`; team sign-off in the phase doc.
EOF
} | tee "$REPORT"
echo "report: $REPORT"
[[ $fails -eq 0 ]]
