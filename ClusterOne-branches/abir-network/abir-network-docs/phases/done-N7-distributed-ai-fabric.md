# Phase N7 — Distributed AI Fabric

> **Goal:** Tune the fabric for multi-node NCCL traffic, benchmark it honestly, and give
> the team a defensible answer to *"can ClusterOne actually train one model across
> several PCs, and how well?"*

| | |
|---|---|
| **Duration** | 5–8 days (week 8–10) |
| **Entry condition** | N6 signed off (Milestone 2); Slurm working; a 2-node DDP script from Sadik Fahim |
| **Blocks** | The project's second headline claim |
| **Blocked by** | Sadik Fahim's test script; GPU nodes free for exclusive benchmarking |

---

## Why this phase exists

This is the phase the whole networking module builds toward, and it is the one where
being rigorous matters most. ClusterOne's second selling point is *"one AI job across
multiple PCs."* Whether that is impressive or embarrassing is decided almost entirely
by the network — and my job is to measure exactly where the line falls, not to hope.

**The honest expectation, before I measure anything:** on 1 GbE, multi-node DDP will be
communication-bound for most real models. That is a known, published property of the
hardware, not a failure of our work. The valuable deliverable is the **scaling curve and
the crossover point** — the model size and batch size below which multi-node is a loss
and above which it starts to pay. Nobody else on the team can produce that number.

---

## 1. The physics, before the tuning

Every DDP step synchronises the full gradient buffer. Ring all-reduce moves
`2 × (N−1)/N × model_size` bytes per GPU per step.

| Model | Params | fp32 grads | Bytes moved/step (4 GPUs) | Time @ 118 MB/s |
|-------|--------|-----------|---------------------------|-----------------|
| ResNet-18 | 11 M | 45 MB | ~67 MB | ~0.57 s |
| ResNet-50 | 25 M | 100 MB | ~150 MB | ~1.27 s |
| BERT-base | 110 M | 440 MB | ~660 MB | ~5.6 s |
| GPT-2 small | 124 M | 496 MB | ~744 MB | ~6.3 s |

Compare against compute time per step on an RTX 3060 (roughly 0.05–0.3 s for typical
batches). **Communication dominates by an order of magnitude.** That's the finding — and
it produces three genuinely useful recommendations:

1. **Larger batch per GPU** → fewer sync events per epoch → better ratio.
2. **Gradient accumulation** → sync every K steps instead of every step → ~K× less traffic.
3. **fp16/bf16 gradients** → half the bytes → ~2× less traffic.

All three are Sadik Fahim's to implement; all three are *my* findings to hand him. This
is the most valuable thing the networking module produces for another teammate.

---

## Tasks

### N7.1 — Verify jumbo frames end-to-end (again, under the real config)

```bash
# every pair, both directions
ping -M do -s 8972 -c 3 gpu02

# confirm it's actually in effect
ip link show eno1 | grep mtu
```

If any pair fails, NCCL will silently fragment and lose a large share of the benefit.
Fix before measuring — measuring a broken MTU produces a misleading baseline.

### N7.2 — Tune the TCP stack for bulk transfer

`/etc/sysctl.d/99-clusterone-net.conf`:

```conf
# larger socket buffers for high-throughput flows
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864

# more room before the kernel drops
net.core.netdev_max_backlog = 30000
net.core.somaxconn = 4096

# BBR handles the loaded-latency case much better than cubic
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

net.ipv4.tcp_mtu_probing = 1
```

```bash
sudo sysctl --system
sysctl net.ipv4.tcp_congestion_control     # confirm: bbr
```

**Re-run the N5 matrix after this change.** Tuning without re-measuring is guessing;
record before/after in the report. If BBR doesn't help on this fabric, say so and keep
cubic — an honest negative result is still a result.

### N7.3 — NCCL configuration

The environment variables that actually matter here — full explanations in
[`reference/nccl-and-mtu-tuning.md`](../reference/nccl-and-mtu-tuning.md):

```bash
export NCCL_SOCKET_IFNAME=eno1        # pin to the fabric NIC; never let it pick docker0
export NCCL_IB_DISABLE=1              # no InfiniBand here
export NCCL_P2P_DISABLE=0             # keep intra-node GPU P2P where available
export NCCL_DEBUG=INFO                # first runs only — shows the ring it built
export NCCL_SOCKET_NTHREADS=4         # more sockets = better 1 GbE utilisation
export NCCL_NSOCKS_PERTHREAD=4
export NCCL_ALGO=Ring                 # Tree can win at small sizes; measure both
```

`NCCL_SOCKET_IFNAME` is the one that bites everyone: with Docker or a second NIC present,
NCCL will happily choose `docker0` or the campus interface and hang or crawl. Pin it.

Ship these as `/etc/profile.d/clusterone-nccl.sh` so every job inherits them and nobody
has to remember.

### N7.4 — Benchmark with `nccl-tests`

```bash
git clone https://github.com/NVIDIA/nccl-tests && cd nccl-tests && make

# single node, all local GPUs — the ceiling with no network involved
./build/all_reduce_perf -b 8 -e 512M -f 2 -g <num_gpus>

# two nodes — the number this whole phase exists to produce
mpirun -np 2 -H gpu01:1,gpu02:1 \
  -x NCCL_SOCKET_IFNAME=eno1 -x NCCL_DEBUG=INFO -x LD_LIBRARY_PATH \
  ./build/all_reduce_perf -b 8 -e 512M -f 2 -g 1
```

Read the **busbw** column. Expected, roughly:

| Configuration | Expected busbw | Note |
|--------------|----------------|------|
| 1 node, 1 GPU | n/a | no communication |
| 1 node, 2 GPUs (PCIe) | 5–10 GB/s | intra-node, no network |
| **2 nodes, 1 GbE** | **0.10–0.11 GB/s** | ~50–100× slower than intra-node |
| 2 nodes, 10 GbE (future) | ~1.1 GB/s | the upgrade case |

That 50–100× gap **is the headline result of this phase.** Present it as a measurement,
with the recommendation attached, not as a disappointment.

### N7.5 — Real DDP scaling test

With Sadik Fahim's script, same model, same total batch size, three configurations:

| Config | GPUs | Nodes | Measure |
|--------|------|-------|---------|
| A | 1 | 1 | wall-clock per epoch (the baseline) |
| B | 2 | 1 | intra-node scaling — should be near 2× |
| C | 2 | 2 | **inter-node scaling — the number that matters** |
| D | 4 | 4 | does it get worse or better with more nodes? |

Compute for each: speedup vs. A, scaling efficiency (`speedup / n_gpus`), and the
fraction of step time spent in communication (`NCCL_DEBUG` timings or a PyTorch profiler
trace from Fahim).

Then run the three mitigations from §1 and re-measure:

- batch size ×4
- gradient accumulation every 4 steps
- fp16/bf16 gradient compression

The delta from these three is the practical guidance the report exists to give.

### N7.6 — Optional: NIC bonding

If nodes have a second usable NIC and the switch is managed (LACP-capable):

```yaml
# netplan
  bonds:
    bond0:
      interfaces: [eno1, enp3s0]
      addresses: [10.42.0.21/24]
      mtu: 9000
      parameters:
        mode: 802.3ad
        lacp-rate: fast
        mii-monitor-interval: 100
        transmit-hash-policy: layer3+4     # per-flow hashing; layer2 would pin everything to one link
```

Measure honestly: a single TCP stream still rides one link. NCCL with
`NCCL_SOCKET_NTHREADS=4` opens several sockets, so bonding *may* help — expect maybe
1.3–1.7×, not 2×. Report what actually happened.

### N7.7 — Write the report

`reports/N7-nccl.md` must contain:

1. The measured all-reduce bus bandwidth, 1-node vs 2-node vs 4-node
2. The DDP scaling curve (efficiency vs. GPU count)
3. The effect of each of the three mitigations
4. A clear statement of **which workloads multi-node is viable for today** and which are not
5. A costed upgrade recommendation (10 GbE vs 25 GbE) justified by our own numbers
6. Raw output in an appendix so the numbers can be re-checked

---

## Deliverables

- [ ] `/etc/profile.d/clusterone-nccl.sh` deployed cluster-wide
- [ ] `/etc/sysctl.d/99-clusterone-net.conf` deployed, with before/after measurements
- [ ] `reference/nccl-and-mtu-tuning.md` — finalised, handed to Sadik Fahim
- [ ] `reports/N7-nccl.md` — the flagship report of this module
- [ ] Bonding results (if attempted)
- [ ] A costed 10/25 GbE upgrade proposal for the department

---

## Exit gate

> **A 2-node `all_reduce_perf` completes successfully and its bus bandwidth is recorded;
> a real DDP job runs across 2 nodes to completion; the scaling curve and the three
> mitigation results are published.**

Note what "pass" means here: **the benchmark runs and is measured.** Slow numbers are a
finding, not a failure. Failing to produce numbers would be the failure.

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| NCCL hangs at init | Picked the wrong interface (`docker0`, campus NIC) | `NCCL_SOCKET_IFNAME=eno1` |
| `unhandled system error` | Rendezvous/ephemeral ports blocked | N4 rules 29400–29600 + 32768–60999 |
| Works on 1 node, hangs on 2 | node→node SSH not passwordless | Back to N3.3 |
| Bus bandwidth far below 0.1 GB/s | MTU not 9000 end-to-end, or a 100 Mb link | N7.1, then N1.3 |
| 2 nodes slower than 1 node | Expected on 1 GbE for most models | The finding — apply §1's mitigations and report the curve |
| Different NCCL versions across nodes | Mismatched container images | Tanjimul's images must be identical everywhere |
| `NCCL WARN Bootstrap : no socket interface found` | Interface name differs per node (`eno1` vs `enp3s0`) | Normalise names, or set the var per node |
