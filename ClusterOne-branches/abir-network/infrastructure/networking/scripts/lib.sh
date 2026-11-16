#!/usr/bin/env bash
# lib.sh — shared helpers, sourced by the other scripts. Bash 3.2 compatible (macOS dev boxes).
# shellcheck shell=bash

_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NET_ROOT="$(cd "$_LIB_DIR/.." && pwd)"
NODES_CSV="${NODES_CSV:-$NET_ROOT/inventory/nodes.csv}"
# shellcheck disable=SC2034  # used by scripts that source this file
DOMAIN="clusterone.internal"
# shellcheck disable=SC2034
ANCHOR_IP="10.42.0.10"
REPORT_DIR="${REPORT_DIR:-$NET_ROOT/reports}"
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=yes"

die()  { echo "error: $*" >&2; exit 1; }
warn() { echo "warn: $*" >&2; }
need() { local c; for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "missing command: $c"; done; }

# nodes_list [role]  → "name ip" per line; role = controller|compute|all (default all)
nodes_list() {
  local want="${1:-all}" name ip role
  [[ -r "$NODES_CSV" ]] || die "cannot read $NODES_CSV"
  while IFS=, read -r name ip role; do
    [[ -z "$name" || "$name" == \#* || "$name" == shortname ]] && continue
    [[ "$want" == all || "$want" == "$role" ]] && echo "$name $ip"
  done < "$NODES_CSV"
}

# node_ip NAME → IP (empty if unknown)
node_ip() { nodes_list | awk -v n="$1" '$1==n {print $2}'; }

# run_on IP cmd…  → run locally when IP is one of this host's addresses, else over ssh
run_on() {
  local ip="$1"; shift
  if [[ "$ip" == local ]] || { command -v hostname >/dev/null && hostname -I 2>/dev/null | tr ' ' '\n' | grep -qx "$ip"; }; then
    bash -c "$*"
  else
    # shellcheck disable=SC2086
    ssh $SSH_OPTS "$ip" "$*"
  fi
}

stamp() { date +%Y%m%d-%H%M%S; }
report_path() { mkdir -p "$REPORT_DIR"; echo "$REPORT_DIR/$1-$(stamp).${2:-md}"; }
