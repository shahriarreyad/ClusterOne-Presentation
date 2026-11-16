# Phase N5 — Performance Baseline

> **Goal:** Publish measured bandwidth and latency numbers for every node pair, so that
> from here on the project talks about the network with data instead of adjectives.

| | |
|---|---|
| **Duration** | 3–4 days (week 5–6) |
| **Entry condition** | N4 signed off — firewall in place (measure the *real* config, not a pre-firewall one) |
| **Blocks** | N7 (no scaling analysis without a baseline), Zafor's alert thresholds |
| **Blocked by** | Nothing |

---

## Why this phase exists

Three things depend on having numbers:

1. **Diagnosis.** In week 10, "the cluster feels slow" is unanswerable without a
   known-good baseline to diff against. RB-03 is built on this data.
2. **Alerting.** Zafor cannot set a threshold without knowing what normal is.
3. **Credibility.** The project's energy and performance claims must be measured. When
   we recommend 25 GbE, the recommendation should be backed by our own numbers, not by
   a vendor's marketing.

---

## Tasks

### N5.1 — Standardise the measurement method

Fix these and never vary them between runs, or the data isn't comparable:

| Parameter | Value | Why |
|-----------|-------|-----|
| Tool | `iperf3` (same version everywhere) | Version differences change defaults |
| Duration | 30 s per direction | Long enough past TCP slow-start |
| Streams | `-P 1` (single) **and** `-P 4` (parallel) | Single = one-flow ceiling, parallel = aggregate |
| Direction | Both (`-R` for reverse) | Asymmetric problems are common and easy to miss |
| Cluster state | **Idle** — no jobs running | Otherwise you're measuring the job, not the link |
| MTU at test time | Record it | 1500 vs 9000 results are not comparable |

Record the date, git commit of the config, and the MTU with every result set.

### N5.2 — Bandwidth matrix

Use [`scripts/iperf-matrix.sh`](../scripts/iperf-matrix.sh):

```bash
./scripts/iperf-matrix.sh anchor01 gpu01 gpu02 gpu03 gpu04 gpu05
```

Output format for the report:

```text
TCP bandwidth (Mbit/s), single stream, 30 s, MTU 9000, 2026-XX-XX

           anchor01  gpu01   gpu02   gpu03   gpu04   gpu05
anchor01      —       941     938     940     939     941
gpu01        940       —      942     941     940     939
gpu02        939      941      —      940     938     940
gpu03        941      940     939      —      941     940
gpu04        938      939     940     941      —      939
gpu05        940      941     938     940     939      —
```

**Pass thresholds (1 GbE):**

| Metric | Pass | Investigate | Fail |
|--------|------|-------------|------|
| Single-stream TCP | ≥ 900 Mbit/s | 700–900 | < 700 |
| Parallel (`-P 4`) | ≥ 940 Mbit/s | 850–940 | < 850 |
| Retransmits over 30 s | < 10 | 10–100 | > 100 |

Any cell below "pass" gets a root-cause note in the report. One slow pair is almost
always a cable or a port — swap and re-measure before writing it up.

### N5.3 — Latency matrix

```bash
# baseline RTT
ping -c 100 -i 0.2 gpu02 | tail -2

# latency under load — run while an iperf3 is saturating the same link
# this is the number that predicts DDP behaviour
ping -c 100 -i 0.2 gpu02 | tail -2
```

**Expected on a 1 GbE switch:**

| Condition | Typical RTT | Concerning |
|-----------|------------|-----------|
| Idle | 0.15–0.35 ms | > 1 ms |
| Under saturation (bufferbloat) | 1–10 ms | > 50 ms |
| Jitter (mdev) | < 0.1 ms idle | > 1 ms idle |

**Latency under load is the single most predictive number for distributed training.**
NCCL's all-reduce is synchronous: every step waits for the slowest link. A fabric with
940 Mbit/s and 40 ms loaded latency will train worse than one with 800 Mbit/s and 2 ms.

If loaded latency is terrible, that's bufferbloat in the switch — note it, and try `fq_codel`
as the qdisc in N7:

```bash
sudo tc qdisc replace dev eno1 root fq_codel
```

### N5.4 — Packet loss and stability soak

```bash
# 10-minute flood-free loss test per pair
ping -c 3000 -i 0.2 -q gpu02

# concurrent multi-pair saturation, then re-read counters
ip -s link show eno1
```

Pass: **0.00% loss** idle, **< 0.1%** under saturation. Loss on a wired LAN is not
normal — it means a cable, a port, a NIC buffer, or an oversubscribed switch.

### N5.5 — MTU / path verification

```bash
# 9000 MTU means 8972 bytes of ICMP payload (9000 − 20 IP − 8 ICMP)
ping -M do -s 8972 -c 3 gpu02     # must succeed on the fabric

# find the true path MTU if it fails
tracepath gpu02
```

If this fails while `ip link` shows `mtu 9000` on both ends, the **switch** is not
passing jumbo frames — go back to N1.5. This is exactly the failure that makes people
give up on jumbo frames; it's a switch setting, not a Linux problem.

### N5.6 — Application-shaped tests

Synthetic `iperf3` is a ceiling, not a prediction. Add two realistic transfers:

```bash
# large sequential file — models dataset staging
dd if=/dev/zero of=/tmp/test10g bs=1M count=10240
time rsync --progress /tmp/test10g gpu02:/tmp/

# many small files — models checkpointing and code sync (much slower, and that's expected)
time rsync -a ./many-small-files/ gpu02:/tmp/msf/
```

Note the gap: bulk transfer approaches line rate; many-small-files is dominated by
round-trips, not bandwidth. This distinction matters for Shanto's storage design.

### N5.7 — Publish

Write `reports/N5-baseline.md` using
[`templates/network-test-report.md`](../templates/network-test-report.md), and hand it to:

- **Zafor** → alert thresholds (e.g. alert if a link's throughput drops below 700 Mbit/s)
- **Sadik Fahim** → the ceiling his DDP work has to live inside
- **Shanto** → staging-time estimates for datasets
- **Ferdowsi** → docs and the research write-up

---

## Deliverables

- [ ] `scripts/iperf-matrix.sh` — reproducible, committed
- [ ] `reports/N5-baseline.md` — bandwidth matrix, latency matrix, loss, MTU, app-shaped results
- [ ] Recommended alert thresholds, sent to Zafor
- [ ] A short "what this fabric can and cannot do" paragraph, in plain English, for the team

---

## Exit gate

> **A committed N×N bandwidth + latency matrix in which every pair meets the pass
> threshold, 0% idle packet loss, and verified 9000-byte path MTU between every pair.**

Any cell that fails must have either a fix applied and a re-measurement, or a written
root cause plus an accepted risk.

---

## Interpreting the numbers honestly

```text
1 GbE line rate      = 1000 Mbit/s
Real TCP throughput  ≈ 940 Mbit/s   ≈ 118 MB/s
```

What that means concretely:

| Task | Time on this fabric |
|------|--------------------|
| Stage a 10 GB dataset | ~85 s |
| Stage a 100 GB dataset | ~14 min |
| Sync a 100 MB gradient buffer once | ~0.85 s |
| Sync it 1000 times (one epoch of DDP) | **~14 min of pure network wait** |

That last row is the whole argument for N7's conclusions, and the reason the project plan
already defers serious multi-node training until faster networking exists. My job in N7
is to put a real number on it — not to pretend it isn't there.

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| One pair much slower than the rest | Cable, port, or a 100 Mb negotiation | `ethtool` both ends; swap cable; re-test |
| Reverse direction much slower | Duplex mismatch or an asymmetric NIC issue | Check `ethtool` both ends, both directions |
| Great throughput, terrible loaded latency | Switch bufferbloat | `fq_codel` qdisc; note it for N7 |
| Numbers vary run to run | A job was running, or thermal throttling | Re-measure on a truly idle cluster |
| `ping -M do -s 8972` fails | Switch not passing jumbo frames | N1.5 switch config |
| `iperf3` maxes at ~94 Mbit/s | The link is 100 Mb, not 1 Gb | Layer 1 — back to N1.3 |
