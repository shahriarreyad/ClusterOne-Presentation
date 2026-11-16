#!/usr/bin/env bash
# ddp-scaling.sh — measure DDP throughput at 1..N nodes and report scaling efficiency (N7).
#
#   ddp-scaling.sh [-m MAX_NODES] [-s STEPS]
#
# Runs a small synthetic all-reduce-bound DDP loop (PyTorch, no dataset) via srun/torchrun
# at 1, 2, … MAX nodes and prints samples/s and efficiency = throughput(N) / (N × throughput(1)).
# Efficiency below ~80% at 2 nodes usually means the network, not the model.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"
need srun

MAX=$(nodes_list compute | wc -l | tr -d ' '); STEPS=50
while [[ $# -gt 0 ]]; do
  case "$1" in -m) MAX="$2"; shift 2 ;; -s) STEPS="$2"; shift 2 ;; *) die "unknown option: $1" ;; esac
done

PY="$(mktemp /tmp/ddp-scale-XXXXXX.py)"; trap 'rm -f "$PY"' EXIT
cat > "$PY" <<'PYEOF'
import os, sys, time, torch, torch.distributed as dist
steps = int(sys.argv[1])
dist.init_process_group("nccl")
rank, world = dist.get_rank(), dist.get_world_size()
torch.cuda.set_device(int(os.environ.get("LOCAL_RANK", 0)))
model = torch.nn.Sequential(*[torch.nn.Linear(4096, 4096) for _ in range(8)]).cuda()
model = torch.nn.parallel.DistributedDataParallel(model)
opt = torch.optim.SGD(model.parameters(), lr=1e-3)
x = torch.randn(64, 4096, device="cuda")
for i in range(steps + 10):
    if i == 10: torch.cuda.synchronize(); t0 = time.time()
    opt.zero_grad(); model(x).sum().backward(); opt.step()
torch.cuda.synchronize()
if rank == 0: print(f"RESULT {64 * world * steps / (time.time() - t0):.1f}")
PYEOF

# shellcheck disable=SC1091
[[ -r /etc/profile.d/clusterone-nccl.sh ]] && source /etc/profile.d/clusterone-nccl.sh
out="$(report_path ddp-scaling)"; base=""
{ echo "| nodes | samples/s | efficiency |"; echo "|---|---|---|"; } | tee "$out"
for ((n=1; n<=MAX; n++)); do
  head="$(nodes_list compute | sed -n '1p' | awk '{print $2}')"
  rate="$(srun -N "$n" --ntasks-per-node=1 --gpus-per-node=1 bash -c \
    "torchrun --nnodes=$n --nproc_per_node=1 --rdzv_backend=c10d --rdzv_endpoint=$head:29400 $PY $STEPS" 2>/dev/null \
    | awk '/^RESULT/ {print $2}')"
  [[ -n "$rate" ]] || { echo "| $n | FAILED | - |" | tee -a "$out"; continue; }
  [[ -n "$base" ]] || base="$rate"
  eff="$(awk -v r="$rate" -v b="$base" -v n="$n" 'BEGIN{printf "%.0f%%", r/(n*b)*100}')"
  echo "| $n | $rate | $eff |" | tee -a "$out"
done
echo "saved: $out"
