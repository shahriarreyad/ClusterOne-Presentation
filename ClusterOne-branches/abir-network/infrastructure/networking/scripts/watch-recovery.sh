#!/usr/bin/env bash
# watch-recovery.sh — time how long a node takes to come back after a reboot / link flap (N5).
#
#   watch-recovery.sh NODE_NAME|IP
#
# Start it, then reboot the node (or pull its cable). Reports seconds to: ping down,
# ping back, ssh back. Compare with the recovery target in the N5 phase doc.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

[[ $# -eq 1 ]] || die "usage: $0 NODE_NAME|IP"
TARGET="$1"
[[ "$TARGET" =~ ^[0-9.]+$ ]] || { TARGET="$(node_ip "$1")"; [[ -n "$TARGET" ]] || die "unknown node $1"; }

up() { ping -c1 -W1 "$TARGET" >/dev/null 2>&1; }
# shellcheck disable=SC2086
sshup() { ssh $SSH_OPTS "$TARGET" true >/dev/null 2>&1; }

echo "waiting for $TARGET to go down (trigger the reboot now)…"
while up; do sleep 0.5; done
t_down=$(date +%s); echo "down at $(date +%T)"
while ! up; do sleep 1; done
t_ping=$(date +%s); echo "ping back after $((t_ping - t_down))s"
while ! sshup; do sleep 1; done
t_ssh=$(date +%s); echo "ssh back after $((t_ssh - t_down))s"
