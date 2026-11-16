# Phase N6 — Storage & Monitoring Network Paths

> **Goal:** The two highest-volume, always-on traffic classes — NFS storage and
> Prometheus scraping — flow cleanly, are tuned for this fabric, and are measured.

| | |
|---|---|
| **Duration** | 3–5 days (week 6–7) |
| **Entry condition** | N5 signed off; Shanto's NFS server up; Zafor's exporters deployed |
| **Blocks** | 🏁 **Milestone 2** |
| **Blocked by** | Shanto (NFS export list), Zafor (exporter ports + scrape interval) |

---

## Why this phase exists

These two are *not* mine to build — but the network path they run over is. They fail in
ways that look like storage bugs or monitoring bugs and are actually network problems:

- NFS hanging is nearly always MTU, a blocked `mountd` port, or a stale mount after a
  network blip.
- Prometheus targets flapping is nearly always firewall or DNS, not Prometheus.

This phase makes those paths explicitly mine to verify, so Shanto and Zafor stop losing
days to them.

---

## Tasks

### N6.1 — NFS network path

**Ports** (already allowed in N4, verify they actually work):

```bash
# from a compute node
rpcinfo -p anchor01 | grep -E 'nfs|mountd|portmapper'
nc -z -w2 anchor01 2049  && echo "OK nfs"
nc -z -w2 anchor01 111   && echo "OK rpcbind"
nc -z -w2 anchor01 20048 && echo "OK mountd"
showmount -e anchor01
```

**Mount options I recommend to Shanto** (network-relevant only — the export config is his):

```text
nfsvers=4.2      modern, single-port (2049), far friendlier to a firewall
proto=tcp        never UDP for NFS on a cluster
rsize=1048576    1 MB reads — pairs with MTU 9000
wsize=1048576
hard             a soft mount silently corrupts data on a network blip; never use it
timeo=600        60 s before retry (units are deciseconds)
retrans=2
noatime          kills a huge amount of pointless write traffic on dataset reads
_netdev          don't try to mount before the network is up at boot
```

`hard` vs `soft` is worth being firm about: with `soft`, a transient network problem
turns into an I/O error mid-training and can corrupt a checkpoint. `hard` blocks and
resumes. On a cluster, always `hard`.

**Measure the path:**

```bash
# sequential read from NFS — the dataset-staging case
dd if=/mnt/datasets/testfile of=/dev/null bs=1M count=5000 status=progress

# sequential write
dd if=/dev/zero of=/mnt/scratch/testfile bs=1M count=5000 conv=fdatasync status=progress
```

Target: **≥ 100 MB/s** sequential on 1 GbE (line rate is ~118 MB/s; NFS overhead makes
100+ a good result). Below 60 MB/s means MTU isn't actually 9000 end-to-end, `rsize` is
small, or the server's disk — not the network — is the bottleneck. Distinguish by
running `iperf3` on the same pair: if iperf3 is 940 Mbit/s and NFS is 40 MB/s, it isn't
the network.

**Concurrency test** — 3 nodes reading simultaneously. Aggregate is capped at the
server's single 1 GbE link (~118 MB/s **total**, not per node). That ceiling is exactly
why the project stages datasets to node-local NVMe before training; confirm the number
so the policy is backed by evidence.

### N6.2 — Monitoring path

```bash
# from anchor01, each exporter must answer
curl -s http://gpu01:9100/metrics | head -5
curl -s http://gpu01:9400/metrics | head -5

# and must NOT answer from anywhere else (negative test)
ssh gpu02 'curl -s --max-time 3 http://gpu01:9100/metrics' && echo "FAIL" || echo "OK blocked"
```

**Scrape traffic budget** — worth calculating so nobody worries about it:

```text
node_exporter payload  ≈ 50–100 KB per scrape
dcgm-exporter payload  ≈ 10–30 KB per scrape
6 nodes × 130 KB / 15 s ≈ 52 KB/s ≈ 0.4 Mbit/s
```

That's **0.04% of the link**. Monitoring is never the reason the cluster is slow; having
this number written down ends that argument permanently.

### N6.3 — Network metrics for Zafor

Hand over the exact metric names and thresholds I want graphed:

| Metric | Alert when | Meaning |
|--------|-----------|---------|
| `node_network_up{device="eno1"}` | `== 0` | Link down — page immediately |
| `rate(node_network_receive_errs_total[5m])` | `> 0` | Cable/port fault developing |
| `rate(node_network_receive_drop_total[5m])` | `> 0` | NIC buffer overrun (R2) |
| `rate(node_network_transmit_bytes_total[5m])` | `> 100 MB/s` sustained 10 min | Link saturated — likely dataset staging |
| `node_network_mtu_bytes{device="eno1"}` | `!= 9000` | Someone's config drifted |
| `probe_duration_seconds` (blackbox ICMP) | `> 5 ms` | Latency degradation |
| `up{job="node"}` | `== 0` for 2 min | Node unreachable → RB-02 |

Ask Zafor to add a **blackbox exporter** for ICMP between nodes — that gives a continuous
latency graph, which is what turns RB-03 from guesswork into a lookup.

### N6.4 — Failure behaviour

Test what actually happens when the network breaks under load. Nobody does this, and it's
the most valuable half-day of the phase:

1. Start a large NFS read on `gpu01`.
2. Unplug `gpu01`'s cable for 30 s, then plug it back in.
3. Observe: does the read resume (correct, `hard` mount) or error out (`soft` — fix it)?
4. Does the mount go stale and need `umount -f`? Document exactly what recovers it.
5. Does Prometheus mark the node down and then recover cleanly?
6. Does Slurm drain the node, and does it come back automatically or need `scontrol update`?

Everything learned here goes straight into
[`RB-02-node-unreachable.md`](../runbooks/RB-02-node-unreachable.md).

### N6.5 — Traffic separation (design note for later)

With one fabric, dataset staging and NCCL contend for the same wire. Options, in order
of cost:

| Option | Cost | Effect |
|--------|------|--------|
| Stage datasets before the training step (project policy already) | Free | Removes most of the contention |
| `tc` traffic shaping: prioritise small control packets over bulk | Low | Protects Slurm/heartbeat during staging |
| Separate VLAN + NIC for NCCL (`net-fast`, VLAN 43) | Medium | Real isolation; needs a second NIC per node |
| 10/25 GbE fabric | High | The actual fix — recommend it with N5/N7 data |

Record the recommendation; implement option 1 and 2 now, design for 3.

---

## Deliverables

- [ ] `reports/N6-paths.md` — NFS throughput, concurrency ceiling, scrape budget, failure-behaviour results
- [ ] Recommended NFS mount options, sent to Shanto with the measurements behind them
- [ ] Network metric + alert list, sent to Zafor
- [ ] RB-02 updated with real observed recovery behaviour
- [ ] Traffic-separation recommendation written up

---

## Exit gate 🏁 (contributes to **Milestone 2**)

> **Sustained NFS sequential read ≥ 100 MB/s from every compute node; Prometheus scrapes
> every node with zero failures for 24 continuous hours; a cable-pull test recovers
> without manual intervention on the storage path.**

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| NFS mount hangs at boot | Mounted before the network was up | Add `_netdev` and `x-systemd.requires=network-online.target` |
| NFS very slow, iperf3 fine | Small `rsize`/`wsize`, or MTU not really 9000 end-to-end | Verify with `ping -M do -s 8972`; set 1 MB rsize/wsize |
| `Stale file handle` after a blip | Server restarted or the export changed | `umount -f` then remount; document in RB-02 |
| Prometheus target flapping | DNS or firewall, not Prometheus | `curl` the exporter from the anchor; check `nft list ruleset` |
| Aggregate NFS throughput ≈ single-node | Server has one 1 GbE link — expected | Bond the server NIC, or stage to local NVMe |
| Everything slows when someone copies a dataset | Bulk traffic starving control traffic | `tc` prioritisation; enforce the staging policy |
