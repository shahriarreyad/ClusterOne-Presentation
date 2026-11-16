# /etc/profile.d/clusterone-nccl.sh — cluster-wide NCCL environment (N7.3).
# See reference/nccl-and-mtu-tuning.md §3 for what each variable does.
#
# NCCL_SOCKET_IFNAME is derived from the interface that carries the fabric address, so it
# is right on every node even where NIC names differ (eno1 / enp3s0 / bond0) — the exact
# failure "NCCL WARN Bootstrap : no socket interface found" in N7's failure table.
# Override before sourcing to force a value: NCCL_SOCKET_IFNAME=... . /etc/profile.d/...

if [ -z "${NCCL_SOCKET_IFNAME:-}" ]; then
  _c1_if="$(ip -4 -o addr show to 10.42.0.0/24 2>/dev/null | awk 'NR==1{print $2}')"
  export NCCL_SOCKET_IFNAME="${_c1_if:-eno1}"
  unset _c1_if
fi

# no InfiniBand on this cluster — stop NCCL probing for it
export NCCL_IB_DISABLE=1
# keep intra-node GPU peer-to-peer where the hardware supports it
export NCCL_P2P_DISABLE=0
# several parallel TCP streams use a 1 GbE link far better than one
export NCCL_SOCKET_NTHREADS=4
export NCCL_NSOCKS_PERTHREAD=4

# --- first runs / debugging only (very verbose) ---
# export NCCL_DEBUG=INFO
# export NCCL_DEBUG_SUBSYS=INIT,NET
# --- N7.4: Ring vs Tree — measure both, don't assume ---
# export NCCL_ALGO=Ring
