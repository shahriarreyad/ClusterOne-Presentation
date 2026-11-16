#!/usr/bin/env bash
# soak.sh — long-running stability probe: continuous ping to every node, log any loss (N5/N7).
#
#   soak.sh [-d SECONDS] [-o LOGFILE]
#
# Default 3600 s. Writes a line per lost/late reply with a timestamp, and a summary at the
# end. Run it while the cluster is busy: intermittent loss only appears under real load.
# Exit 1 if any loss occurred.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

DUR=3600; LOG=""
while [[ $# -gt 0 ]]; do
  case "$1" in -d) DUR="$2"; shift 2 ;; -o) LOG="$2"; shift 2 ;; *) die "unknown option: $1" ;; esac
done
[[ -n "$LOG" ]] || LOG="$(report_path soak log)"

pids=(); tmpd="$(mktemp -d)"; trap 'kill "${pids[@]}" 2>/dev/null; rm -rf "$tmpd"' EXIT
echo "soak: ${DUR}s → $LOG"
while read -r name ip; do
  (
    ping -i 0.5 -w "$DUR" -O "$ip" 2>&1 | while IFS= read -r line; do
      case "$line" in
        *"no answer yet"*|*unreachable*) echo "$(date -Is) $name LOSS: $line" ;;
      esac
    done > "$tmpd/$name.log"
  ) &
  pids+=("$!")
done < <(nodes_list)
wait

cat "$tmpd"/*.log 2>/dev/null | sort > "$LOG"
lost="$(wc -l < "$LOG" | tr -d ' ')"
echo "soak finished: $lost loss events (see $LOG)"
[[ "$lost" -eq 0 ]]
