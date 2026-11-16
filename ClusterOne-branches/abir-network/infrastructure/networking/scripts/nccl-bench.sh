#!/usr/bin/env bash
# nccl-bench.sh — multi-node all_reduce bandwidth via nccl-tests (N7).
#
#   nccl-bench.sh [-n NODES] [-b MIN] [-e MAX] [--build]
#
# Uses Slurm (`srun`) so the launcher matches production. `--build` clones and builds
# nccl-tests into $NCCL_TESTS (default ~/nccl-tests) — needs egress to github.com.
# NCCL env comes from /etc/profile.d/clusterone-nccl.sh (fabric NIC, IB off, sockets).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

NODES=2; MINB=8M; MAXB=1G; BUILD=0
NCCL_TESTS="${NCCL_TESTS:-$HOME/nccl-tests}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n) NODES="$2"; shift 2 ;; -b) MINB="$2"; shift 2 ;; -e) MAXB="$2"; shift 2 ;;
    --build) BUILD=1; shift ;; *) die "unknown option: $1" ;;
  esac
done
need srun

if [[ $BUILD == 1 ]]; then
  [[ -d "$NCCL_TESTS" ]] || git clone https://github.com/NVIDIA/nccl-tests.git "$NCCL_TESTS"
  make -C "$NCCL_TESTS" -j"$(nproc)" MPI=0 || die "nccl-tests build failed"
fi
BIN="$NCCL_TESTS/build/all_reduce_perf"
[[ -x "$BIN" ]] || die "$BIN not found — run with --build"

# shellcheck disable=SC1091
[[ -r /etc/profile.d/clusterone-nccl.sh ]] && source /etc/profile.d/clusterone-nccl.sh
export NCCL_DEBUG="${NCCL_DEBUG:-WARN}"

out="$(report_path nccl-allreduce log)"
echo "nccl all_reduce on $NODES nodes → $out"
srun -N "$NODES" --ntasks-per-node=1 --gpus-per-node=1 "$BIN" -b "$MINB" -e "$MAXB" -f 2 -g 1 | tee "$out"
echo
echo "Read the 'busbw' column at the largest size. Compare to your iperf line rate:"
echo "busbw close to it = fabric is the ceiling; far below = NCCL env / MTU / firewall problem."
