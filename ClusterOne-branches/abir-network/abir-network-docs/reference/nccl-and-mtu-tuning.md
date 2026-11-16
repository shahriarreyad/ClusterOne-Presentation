# Reference — NCCL, MTU & Fabric Tuning

The network-side guide for distributed training. Written for **Sadik Fahim** (Distributed
AI) and **Sourav Kundu** (distributed job data), but useful to anyone debugging a job that
hangs at `init_process_group`.

---

## 1. What actually crosses the wire

PyTorch DDP synchronises gradients after every backward pass, using NCCL's ring
all-reduce. Bytes moved per GPU per step:

```text
bytes ≈ 2 × (N−1)/N × model_size_bytes        (N = number of GPUs)
```

For fp32 gradients, `model_size_bytes = params × 4`.

| Model | Params | Grad size | 4-GPU traffic/step | @118 MB/s (1 GbE) |
|-------|--------|-----------|--------------------|-------------------|
| ResNet-18 | 11 M | 45 MB | ~67 MB | ~0.57 s |
| ResNet-50 | 25 M | 100 MB | ~150 MB | ~1.27 s |
| BERT-base | 110 M | 440 MB | ~660 MB | ~5.6 s |
| GPT-2 (124M) | 124 M | 496 MB | ~744 MB | ~6.3 s |

An RTX 3060 computes a typical step in 0.05–0.3 s. **Communication is 5–100× the compute
time on this fabric.** That is the constraint everything below works within.

---

## 2. The three things that actually help on 1 GbE

Ranked by impact per unit of effort:

### 1. Gradient accumulation — biggest single win
Sync every K steps instead of every step. Traffic drops ~K×, with identical math to a
K× larger batch.

```python
for i, batch in enumerate(loader):
    with model.no_sync() if (i + 1) % K else contextlib.nullcontext():
        loss = model(batch).loss / K
        loss.backward()
    if (i + 1) % K == 0:
        optimizer.step(); optimizer.zero_grad()
```

`model.no_sync()` is the important part — without it, DDP still all-reduces every step
and accumulation buys nothing on the network.

### 2. Larger per-GPU batch
Fewer sync events per epoch. Limited by VRAM, but on a 12 GB card there is usually room.

### 3. fp16 / bf16 gradients
Halves the bytes. Either use AMP with `bf16`, or DDP's comm hook:

```python
from torch.distributed.algorithms.ddp_comm_hooks import default_hooks as h
model.register_comm_hook(state=None, hook=h.bf16_compress_hook)
```

Roughly 2× less traffic for a small numerical cost. On a communication-bound fabric this
is nearly a free 2× speedup.

**What does not help much here:** switching NCCL algorithms, tweaking buffer sizes,
process pinning. Those matter on fast fabrics where the network isn't already the wall.

---

## 3. NCCL environment variables

Shipped cluster-wide as `/etc/profile.d/clusterone-nccl.sh`:

```bash
# REQUIRED — pin the fabric interface.
# Without this NCCL may choose docker0, a virtual bridge, or the campus NIC,
# and either hang at init or run at a fraction of the speed.
export NCCL_SOCKET_IFNAME=eno1

# no InfiniBand on this cluster
export NCCL_IB_DISABLE=1

# keep intra-node GPU peer-to-peer where the hardware supports it
export NCCL_P2P_DISABLE=0

# more parallel sockets — measurably better utilisation on 1 GbE
export NCCL_SOCKET_NTHREADS=4
export NCCL_NSOCKS_PERTHREAD=4

# first runs only; very verbose
# export NCCL_DEBUG=INFO
# export NCCL_DEBUG_SUBSYS=INIT,NET
```

| Variable | Why it matters here |
|----------|--------------------|
| `NCCL_SOCKET_IFNAME` | **The #1 cause of multi-node hangs.** Always set it. |
| `NCCL_SOCKET_NTHREADS` / `NSOCKS_PERTHREAD` | Multiple TCP streams use a 1 GbE link far better than one |
| `NCCL_ALGO` | `Ring` vs `Tree` — Tree can win for small messages; measure, don't assume |
| `NCCL_DEBUG=INFO` | Prints the ring NCCL built and which interface it chose — the first thing to check when debugging |
| `NCCL_IB_DISABLE` | Stops NCCL probing for InfiniBand that isn't there |

---

## 4. MTU / jumbo frames

```text
MTU 1500  → 1460 bytes payload per packet → ~6% header overhead, ~81k packets/s at 1 Gb
MTU 9000  → 8960 bytes payload per packet → ~0.9% overhead, ~13.5k packets/s at 1 Gb
```

The real win is not the 5% of header bytes — it's **6× fewer packets**, which means 6×
fewer interrupts and far less CPU per gigabyte. That matters most on the weaker onboard
NICs (risk R2).

Enable everywhere on the fabric:

```bash
# temporary
sudo ip link set dev eno1 mtu 9000
# permanent — netplan, mtu: 9000
```

Verify — this is the only check that proves it end to end:

```bash
ping -M do -s 8972 gpu02      # 8972 = 9000 − 20 (IP) − 8 (ICMP)
```

**All three of these must be 9000 or it silently doesn't work:** both NICs *and* the
switch. A mismatch produces black-hole behaviour: small packets fine, large transfers
hang. If `ip link` says 9000 on both ends and the ping still fails, the switch is the
problem — see N1.5.

Keep the anchor's **campus** interface at 1500. Jumbo frames belong on the fabric only.

---

## 5. TCP stack tuning (`/etc/sysctl.d/99-clusterone-net.conf`)

```conf
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864
net.core.netdev_max_backlog = 30000
net.core.somaxconn = 4096
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_mtu_probing = 1
```

BBR generally handles a congested, bufferbloated switch better than cubic — but measure
it on our fabric before and after. If it doesn't help here, keep cubic and record why.

---

## 6. Launching a multi-node job

```bash
# on gpu01 (rank 0)
torchrun --nnodes=2 --node_rank=0 --nproc_per_node=1 \
         --master_addr=gpu01 --master_port=29500 train.py

# on gpu02 (rank 1)
torchrun --nnodes=2 --node_rank=1 --nproc_per_node=1 \
         --master_addr=gpu01 --master_port=29500 train.py
```

Network prerequisites, all delivered by earlier phases:

- `gpu01` resolves from `gpu02` — **N2**
- passwordless node→node SSH — **N3**
- ports 29400–29600 and the ephemeral range open between nodes — **N4**
- MTU 9000 verified — **N5/N7**
- `NCCL_SOCKET_IFNAME` set — **N7**

Under Slurm, `srun` handles rank assignment; `MASTER_ADDR` is typically derived from
`SLURM_NODELIST` — Rahat's side.

---

## 7. Debugging checklist for a hanging multi-node job

Run in this order; the answer is almost always found by step 3.

```bash
# 1. Which interface did NCCL choose?
NCCL_DEBUG=INFO torchrun ... 2>&1 | grep -i 'NET/Socket\|Using network'
#    Should name eno1. If it says docker0 → NCCL_SOCKET_IFNAME.

# 2. Can the nodes reach each other on the rendezvous port?
nc -z -w2 gpu01 29500 || echo "rendezvous port blocked"

# 3. Is node→node SSH clean?
ssh gpu02 'ssh gpu01 hostname'

# 4. Is MTU consistent end to end?
ping -M do -s 8972 -c2 gpu01

# 5. Is the fabric healthy right now?
iperf3 -c gpu01 -t 10        # compare against the N5 baseline

# 6. Same NCCL version everywhere?
python -c "import torch; print(torch.cuda.nccl.version())"
```

---

## 8. Expected numbers (so nobody is surprised)

`all_reduce_perf` **busbw**:

| Setup | busbw | Relative |
|-------|-------|----------|
| Intra-node, 2× GPU over PCIe | 5–10 GB/s | 1× |
| **Inter-node, 1 GbE** | **~0.10 GB/s** | **50–100× slower** |
| Inter-node, 10 GbE | ~1.1 GB/s | ~10× slower |
| Inter-node, 25 GbE | ~2.8 GB/s | ~3× slower |
| Inter-node, InfiniBand HDR | ~24 GB/s | comparable |

**The takeaway to state plainly in any write-up:** with 1 GbE, multi-node DDP is worth it
only for models small enough that gradient sync stays under the compute time, or when the
three mitigations in §2 are applied aggressively. Scaling to more nodes on this fabric
often makes training *slower*, not faster — and demonstrating that with our own numbers
is a legitimate, useful result, not a failure.

---

## 9. Recommended upgrade path

| Step | Cost | Expected gain |
|------|------|--------------|
| Gradient accumulation + bf16 (§2) | **free** | 2–8× less traffic |
| NIC bonding, 2× 1 GbE LACP | ~low | 1.3–1.7× (multi-flow only) |
| 2.5 GbE NICs + switch | low–medium | ~2.5× |
| 10 GbE NICs + switch | medium | ~10× |
| 25 GbE + RDMA-capable NICs | high | ~25× plus much lower latency |

Do §2 first. It's free, it's the biggest ratio improvement available, and it makes the
hardware case stronger when it's backed by "we already optimised the software side."
