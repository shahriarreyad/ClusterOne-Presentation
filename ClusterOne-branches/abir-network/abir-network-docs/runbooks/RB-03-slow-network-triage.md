# RB-03 — "The Cluster Feels Slow"

**Symptoms:** jobs take longer than usual · dataset copies crawl · distributed training
stalls · the dashboard is sluggish.

**First question to answer:** *is it actually the network?* Most of the time it isn't —
and proving that quickly is as valuable as finding a real network fault.

---

## Step 0 — Is it the network at all?

```bash
# compare against the N5 baseline — this is why that baseline exists
iperf3 -c gpu02 -t 10
ping -c 20 gpu02
```

| Result vs. baseline | Conclusion |
|---------------------|-----------|
| Within 10% of baseline | **The network is fine.** Go to "Not the network" below. |
| 10–50% below | Degraded — continue to Step 1 |
| More than 50% below | Something is broken — continue to Step 1 |
| Latency > 5× baseline | Congestion or bufferbloat — Step 3 |

### Not the network → who to hand it to

| Symptom | Likely owner |
|---------|-------------|
| GPU utilisation is low, network is idle | The training script is data-loading bound — Fahim / the user |
| Everything on one node is slow | That node: thermal throttling, a full disk, a runaway process |
| Only the web dashboard is slow | Backend/DB — Rahat / Kundu |
| Jobs sit queued for a long time | Scheduling, not transport — Rahat |
| Reads from `/datasets` are slow but `iperf3` is fine | Storage server disk — Shanto |

---

## Step 1 — Which link is slow?

```bash
./scripts/iperf-matrix.sh anchor01 gpu01 gpu02 gpu03 gpu04 gpu05
```

Diff against `reports/N5-baseline.md`:

- **One node slow to everything** → that node's NIC/cable/port → Step 2
- **One pair slow, others fine** → that specific cable or switch port → Step 2
- **Everything slow** → switch-wide congestion or a saturating job → Step 3
- **Slow in one direction only** → duplex mismatch or an asymmetric NIC fault → Step 2

---

## Step 2 — Single-link investigation

```bash
sudo ethtool <iface> | grep -E 'Speed|Duplex'      # dropped to 100 Mb?
ip -s link show <iface>                            # errors/dropped growing?
sudo ethtool -S <iface> | grep -iE 'err|drop|crc|missed'
```

| Finding | Cause | Fix |
|---------|-------|-----|
| Speed is 100 Mb | Cable degraded or port failing | Replace the cable; move ports |
| `rx_crc_errors` climbing | Physical layer — cable/connector | Replace the cable |
| `rx_missed_errors` climbing | NIC/driver can't keep up (R2) | Interrupt coalescing, or replace the NIC |
| `tx_dropped` climbing | Queue overflow — link is saturated | Step 3 |
| Counters clean, still slow | MTU mismatch → `ping -M do -s 8972 <peer>` | Fix MTU end to end |

---

## Step 3 — Congestion: who is using the wire?

```bash
# live per-connection view
sudo iftop -i eno1
sudo nethogs eno1            # by process

# who has the most sockets open
ss -tin | head -40

# on a managed switch, check per-port counters and utilisation
```

Usual suspects, in order:

1. **Someone staging a large dataset** — expected and legitimate, just slow for others.
   Confirm and wait, or ask them to throttle: `rsync --bwlimit=50000` (50 MB/s).
2. **A distributed training job** — NCCL will happily saturate the link. Expected.
3. **A runaway process or a retry loop** — check `nethogs`; that's a bug, not usage.
4. **Backups or a monitoring misconfiguration** — a scrape interval set to 1 s instead of 15 s.

Mitigation while it's happening:

```bash
# prioritise small control packets so Slurm/heartbeat survive a bulk transfer
sudo tc qdisc replace dev eno1 root fq_codel
```

---

## Step 4 — Distributed training specifically slow

If DDP is slow but `iperf3` is fine, it is very likely **not** a fault:

```bash
NCCL_DEBUG=INFO torchrun ... 2>&1 | grep -i 'NET/Socket\|Ring\|Using network'
```

Check, in order:

1. Did NCCL pick the right interface? (`docker0` = the classic mistake)
2. Is MTU 9000 verified between those two nodes right now?
3. Is another job sharing the link?
4. **Is this just the expected 1 GbE ceiling?** Compare against
   [`reference/nccl-and-mtu-tuning.md`](../reference/nccl-and-mtu-tuning.md) §8. If the
   measured busbw is ~0.10 GB/s, the fabric is behaving exactly as designed and the fix
   is on the software side (gradient accumulation, bf16 — §2), not the network.

Saying "this is the known ceiling, here's the documented mitigation" is a complete and
correct answer.

---

## Step 5 — Escalation

If Steps 1–4 don't explain it, collect this and send it to Abir:

```bash
{
  date; hostname
  ip -br addr; ip -br link
  ethtool eno1 | grep -E 'Speed|Duplex'
  ip -s link show eno1
  ethtool -S eno1 | grep -iE 'err|drop|crc'
  ip route; nft list ruleset
  iperf3 -c anchor01 -t 10
  ping -c 20 anchor01
} > /tmp/net-triage-$(hostname)-$(date +%F).txt
```

---

## Prevention

- Keep the N5 baseline current — re-run the matrix after any network change
- Zafor's Grafana network panel makes Step 1 a glance instead of an investigation
- Enforce the dataset staging policy — it removes the most common congestion source
- Alert on `rate(node_network_receive_errs_total[5m]) > 0` so a degrading cable is
  caught before anyone notices "slow"
