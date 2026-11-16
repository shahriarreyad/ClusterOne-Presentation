# Network Test Report — <phase / date>

Copy to `infrastructure/networking/reports/`. Used for N1, N5, N6, N7 and any incident
follow-up.

---

## 1. Test metadata

| Field | Value |
|-------|-------|
| Date / time | |
| Phase | N_ |
| Run by | |
| Purpose | baseline / regression / post-change / incident |
| Cluster state | idle / jobs running (**say which** — it changes everything) |
| Config commit | `git rev-parse --short HEAD` |
| MTU at test time | 1500 / 9000 |
| Switch | model, firmware, managed/unmanaged |
| `iperf3` version | |

---

## 2. Link status

| Node | Interface | Speed | Duplex | MTU | Link |
|------|-----------|-------|--------|-----|------|
| anchor01 | eno2 | | | | |
| gpu01 | eno1 | | | | |
| gpu02 | eno1 | | | | |

Raw:

```text
$ ethtool eno1
<output>
```

---

## 3. Bandwidth matrix (Mbit/s)

Method: `iperf3 -c <peer> -t 30 -P 1`, both directions, cluster idle.

```text
           anchor01  gpu01   gpu02   gpu03   gpu04   gpu05
anchor01      —
gpu01                 —
gpu02                         —
gpu03                                 —
gpu04                                         —
gpu05                                                 —
```

Parallel (`-P 4`):

```text
(same layout)
```

**Threshold:** ≥ 900 Mbit/s single stream on 1 GbE.
**Cells below threshold:**

| Pair | Measured | Root cause | Action |
|------|----------|-----------|--------|
| | | | |

---

## 4. Latency matrix (ms, avg / mdev)

Method: `ping -c 100 -i 0.2`.

```text
           anchor01  gpu01   gpu02   gpu03
anchor01      —
gpu01                 —
```

Under load (concurrent `iperf3` on the same link):

```text
(same layout)
```

**Threshold:** < 0.5 ms idle, < 10 ms loaded.

---

## 5. Packet loss

| Pair | Packets | Loss % | Notes |
|------|---------|--------|-------|
| | | | |

**Threshold:** 0.00% idle, < 0.1% under load.

---

## 6. MTU verification

| Pair | `ping -M do -s 8972` | Result |
|------|---------------------|--------|
| | | ☐ pass ☐ fail |

---

## 7. Error counters (before → after the test)

| Node | rx_errors | rx_dropped | rx_crc | tx_errors | tx_dropped |
|------|-----------|-----------|--------|-----------|-----------|
| | 0 → 0 | | | | |

Any non-zero delta needs an explanation, not a shrug.

---

## 8. Application-shaped results

| Test | Result | Notes |
|------|--------|-------|
| `rsync` 10 GB single file | __ MB/s | |
| `rsync` many small files | __ files/s | expected to be far slower |
| NFS sequential read | __ MB/s | |
| NFS 3-node concurrent read | __ MB/s aggregate | capped by the server's link |

---

## 9. NCCL / distributed (N7 only)

| Config | Nodes | GPUs | busbw (GB/s) | Notes |
|--------|-------|------|--------------|-------|
| intra-node | 1 | 2 | | |
| inter-node | 2 | 2 | | |
| inter-node | 4 | 4 | | |

DDP scaling:

| Config | GPUs | Nodes | s/epoch | Speedup | Efficiency |
|--------|------|-------|---------|---------|-----------|
| A | 1 | 1 | | 1.00× | 100% |
| B | 2 | 1 | | | |
| C | 2 | 2 | | | |
| D | 4 | 4 | | | |

Mitigation effects:

| Mitigation | s/epoch | vs. baseline |
|-----------|---------|-------------|
| none | | — |
| batch ×4 | | |
| grad accumulation K=4 | | |
| bf16 gradients | | |
| all three | | |

---

## 10. Comparison with the previous baseline

| Metric | Previous | Now | Δ | Verdict |
|--------|----------|-----|---|---------|
| Min pair bandwidth | | | | ☐ ok ☐ regressed |
| Avg latency (idle) | | | | ☐ ok ☐ regressed |
| Packet loss | | | | ☐ ok ☐ regressed |

---

## 11. Conclusions

**What works:**

**What doesn't, and why:**

**What this means for the team** (one plain-English paragraph — this is the part
non-networking teammates will actually read):

**Recommendations:**

| # | Recommendation | Owner | Priority |
|---|---------------|-------|----------|
| 1 | | | |

---

## Appendix — raw output

```text
(everything, unedited, so the numbers can be re-checked)
```
