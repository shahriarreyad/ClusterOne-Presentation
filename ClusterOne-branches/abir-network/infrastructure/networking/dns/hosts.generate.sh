#!/usr/bin/env bash
# hosts.generate.sh — generate the ClusterOne /etc/hosts block from nodes.csv (N2.4).
#
#   hosts.generate.sh [-p] [nodes.csv]
#     (default)  block with BEGIN/END markers, for Ansible `blockinfile` / manual paste
#     -p         plain hosts-format lines, for dnsmasq `addn-hosts`
#
# /etc/hosts is generated, never hand-edited. Format of nodes.csv: shortname,ip,role
set -euo pipefail

PLAIN=0
if [[ "${1:-}" == "-p" ]]; then PLAIN=1; shift; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${1:-$HERE/../inventory/nodes.csv}"
DOMAIN="${DOMAIN:-clusterone.internal}"

[[ -r "$SRC" ]] || { echo "cannot read $SRC" >&2; exit 1; }

(( PLAIN )) || echo "# --- BEGIN CLUSTERONE (generated, do not edit) ---"
while IFS=, read -r name ip _role; do
  [[ -z "${name// }" || "$name" == \#* ]] && continue
  printf '%-15s %-32s %s\n' "$ip" "${name}.${DOMAIN}" "$name"
done < "$SRC"
(( PLAIN )) || echo "# --- END CLUSTERONE ---"
