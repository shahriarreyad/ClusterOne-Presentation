#!/usr/bin/env bash
# clusterone-qos.sh — prioritise control traffic on the fabric NIC (N7.5, OPTIONAL).
#
#   clusterone-qos.sh apply IFACE | clear IFACE | show IFACE
#
# Puts SSH/Slurm/agent/DNS/NTP in a high-priority band so a saturating training job cannot
# starve them. Uses `prio` + u32 filters, which is enough for a 6-node flat fabric.
# Measure first: only keep it if latency-matrix.sh shows control traffic suffering under load.
set -euo pipefail

cmd="${1:-}"; IF="${2:-}"
[[ -n "$cmd" && -n "$IF" ]] || { echo "usage: $0 apply|clear|show IFACE" >&2; exit 2; }
[[ $EUID -eq 0 || "$cmd" == show ]] || { echo "run as root" >&2; exit 1; }

case "$cmd" in
  apply)
    tc qdisc replace dev "$IF" root handle 1: prio bands 3 priomap 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2
    # band 1 (highest): control ports, matched as either source or destination
    for p in 22 6817 6818 9500 53; do
      tc filter add dev "$IF" parent 1: protocol ip prio 1 u32 match ip dport "$p" 0xffff flowid 1:1
      tc filter add dev "$IF" parent 1: protocol ip prio 1 u32 match ip sport "$p" 0xffff flowid 1:1
    done
    # NTP + ICMP
    tc filter add dev "$IF" parent 1: protocol ip prio 1 u32 match ip dport 123 0xffff flowid 1:1
    tc filter add dev "$IF" parent 1: protocol ip prio 1 u32 match ip protocol 1 0xff flowid 1:1
    # bulk traffic falls into band 3 via the priomap; fq_codel keeps it fair
    tc qdisc replace dev "$IF" parent 1:3 handle 30: fq_codel
    echo "qos applied on $IF" ;;
  clear) tc qdisc del dev "$IF" root 2>/dev/null || true; echo "qos cleared on $IF" ;;
  show) tc -s qdisc show dev "$IF"; tc filter show dev "$IF" ;;
  *) echo "unknown command: $cmd" >&2; exit 2 ;;
esac
