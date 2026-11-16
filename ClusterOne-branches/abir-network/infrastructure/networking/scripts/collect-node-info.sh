#!/usr/bin/env bash
# collect-node-info.sh — snapshot a node's network facts for the inventory (N0/N1).
#
#   collect-node-info.sh          # run ON a node; prints markdown
#   collect-node-info.sh --csv    # prints "iface,mac" lines to fill inventory/interfaces.csv
#
# Read-only. Paste the output in the node's section of the docs / a PR.
set -uo pipefail

if [[ "${1:-}" == "--csv" ]]; then
  for d in /sys/class/net/*; do
    i="$(basename "$d")"; [[ "$i" == lo || "$i" == docker* || "$i" == veth* || "$i" == br-* ]] && continue
    echo "$i,$(cat "$d/address")"
  done
  exit 0
fi

echo "# $(hostname) — $(date -Is)"
echo; echo '## OS / kernel';  { . /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"; uname -r; }
echo; echo '## Interfaces'
for d in /sys/class/net/*; do
  i="$(basename "$d")"; [[ "$i" == lo ]] && continue
  printf -- '- %s: mac=%s mtu=%s state=%s speed=%s duplex=%s driver=%s\n' "$i" \
    "$(cat "$d/address")" "$(cat "$d/mtu")" "$(cat "$d/operstate")" \
    "$(cat "$d/speed" 2>/dev/null || echo n/a)" "$(cat "$d/duplex" 2>/dev/null || echo n/a)" \
    "$(basename "$(readlink "$d/device/driver" 2>/dev/null)" 2>/dev/null || echo n/a)"
done
echo; echo '## Addresses';  ip -4 -br addr
echo; echo '## Routes';     ip route
echo; echo '## DNS';        resolvectl status 2>/dev/null | sed -n '1,25p' || cat /etc/resolv.conf
echo; echo '## Time sync';  chronyc tracking 2>/dev/null | sed -n '1,8p' || timedatectl 2>/dev/null
echo; echo '## Listening';  ss -tulnH 2>/dev/null | awk '{print $1, $5}'
echo; echo '## Firewall';   nft list tables 2>/dev/null || echo "nft: not loaded / no permission"
