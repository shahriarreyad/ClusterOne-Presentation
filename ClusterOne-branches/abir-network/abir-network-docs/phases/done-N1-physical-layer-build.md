# Phase N1 — Physical Layer Build

> **Goal:** Every node is physically connected, every link negotiates full speed and
> full duplex, and the wiring is labelled so anyone can trace a cable in 10 seconds.

| | |
|---|---|
| **Duration** | 3–5 days (week 1–2) |
| **Entry condition** | N0 signed off; switch + cables physically present |
| **Blocks** | N2 and everything after it |
| **Blocked by** | Room, power, switch, cables |

---

## Why this phase exists

Layer 1 problems disguise themselves as software bugs. A half-seated RJ45, a Cat5
cable in a 1 Gb port, or a NIC that auto-negotiated 100 Mb/s will produce symptoms that
Rahat will spend two days debugging in the backend. Ten minutes with `ethtool` here saves
that.

---

## Tasks

### N1.1 — Physical placement

- Nodes on a bench/rack with airflow front-to-back; no GPU exhaust into another node's intake
- Switch in the middle of the run so cable lengths are even
- Power: no more than the circuit rating; label which node is on which outlet/strip
- Take a photo of the finished layout for `docs/`

### N1.2 — Cabling and labelling

Every cable gets a label at **both** ends:

```text
Format:  <node>-<iface>  ⇄  SW01-P<port>

Examples:
  anchor01-eno2  ⇄  SW01-P01
  gpu01-eno1     ⇄  SW01-P02
  gpu02-eno1     ⇄  SW01-P03
```

Record the map in `infrastructure/networking/inventory/cable-map.md`:

| Node | Interface | MAC | Switch | Port | Cable cat | Length |
|------|-----------|-----|--------|------|-----------|--------|
| anchor01 | eno2 | `xx:xx:…` | SW01 | 1 | Cat6 | 2 m |
| gpu01 | eno1 | `xx:xx:…` | SW01 | 2 | Cat6 | 3 m |
| … | | | | | | |

Get the MAC with `ip -br link` — MACs go in the map now because N2's DHCP staging pool
and any future PXE work will need them.

### N1.3 — Link verification (per node)

On every machine:

```bash
IFACE=eno1
sudo ethtool $IFACE | grep -E 'Speed|Duplex|Link detected|Auto-negotiation'
```

**Required result:**

```text
Speed: 1000Mb/s
Duplex: Full
Auto-negotiation: on
Link detected: yes
```

Anything less — 100 Mb/s, Half duplex — is a **hard stop**. Causes, in order of
likelihood: bad/short-pinned cable, dirty or damaged port, cable is Cat5 not Cat5e,
NIC driver problem. Swap the cable first; it's the cause ~70% of the time.

Also record the baseline error counters, so N1.4 has something to compare against:

```bash
ip -s link show $IFACE
sudo ethtool -S $IFACE | grep -iE 'err|drop|crc|fail|discard'
```

### N1.4 — Sustained soak (the test everyone skips)

This is what catches the weak-NIC and weak-backplane risks (R1, R2).

**Single-pair soak — 10 minutes per node:**

```bash
# on anchor01
iperf3 -s

# on each gpuNN, one at a time
iperf3 -c anchor01 -t 600 -i 30
```

Pass: ≥ **900 Mbit/s** sustained on 1 GbE, with **zero** retransmits growing steadily.

**All-pairs concurrent soak — the backplane test:**

```bash
# start a server on every node (different ports if needed)
# then, simultaneously from every node, hit a different peer:
#   gpu01 → gpu02, gpu02 → gpu03, gpu03 → gpu04, gpu04 → gpu01
iperf3 -c gpu02 -t 300 -P 4
```

Pass: aggregate stays near N × 900 Mbit/s. A big collapse here means the switch backplane
is the bottleneck → **escalate as R1**, and record the number; it will explain N7's results.

**After the soak, re-check counters:**

```bash
ip -s link show $IFACE      # rx/tx errors and dropped must still be ~0
sudo ethtool -S $IFACE | grep -iE 'err|drop|crc'
```

Growing `rx_crc_errors` → cable/port. Growing `rx_missed_errors` / `dropped` → the NIC
or driver can't keep up (classic Realtek-under-load) → recommend an Intel PCIe NIC for
that node.

### N1.5 — Switch configuration (managed switches only)

- [ ] Set a management IP on `net-oob` (`10.42.9.1/29`), change the default password
- [ ] Update firmware if it's an old build
- [ ] Enable **jumbo frames** to the switch's max (≥ 9216 bytes so a 9000 MTU fits)
- [ ] Create **VLAN 42** (`net-cluster`) and assign the node ports as untagged/access
- [ ] Leave VLAN 43 (`net-fast`) defined but unused — reserved for the future fast fabric
- [ ] Enable flow control **off** (802.3x pause frames cause head-of-line blocking and
      hurt more than they help on a small cluster)
- [ ] Enable per-port statistics; note how to read them (RB-03 uses this)
- [ ] Save the running config and export a backup to `infrastructure/networking/switch/`

If the switch is unmanaged: skip this whole section, record R1 as **realised**, and note
that N8's segmentation will be host-firewall-only.

### N1.6 — Boot resilience check

Power-cycle the whole bench. After boot, every link must come back up on its own with
the same speed/duplex. A link that only works after a manual cable reseat is a fault, not
a quirk.

---

## Deliverables

- [ ] `inventory/cable-map.md` — complete, with MACs
- [ ] `reports/N1-physical.md` — `ethtool` output per node, soak results, counter deltas
- [ ] Switch config backup (if managed)
- [ ] Layout photo in `docs/`
- [ ] [`runbooks/RB-04-switch-or-link-failure.md`](../runbooks/RB-04-switch-or-link-failure.md) drafted from what I learned here

---

## Exit gate

> **Every node reports `1000Mb/s` + `Full` duplex, passes a 10-minute ≥900 Mbit/s
> `iperf3` soak with no growth in error counters, and comes back up correctly after a
> full power cycle.**

Paste the raw `ethtool` and `iperf3` output into the report. Screenshots don't count —
text, so it's greppable and diffable later.

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `Speed: 100Mb/s` | Cat5 cable, damaged pair, or bad port | Swap cable → swap port → suspect NIC |
| `Duplex: Half` | Auto-negotiation mismatch (someone hardcoded a speed on the switch) | Set both sides to auto |
| iperf3 ~940 Mbit/s but jobs feel slow | Nothing — 940 is line rate on 1 GbE (~118 MB/s) | This is the real ceiling; see R3 |
| `iperf3` fine, `rx_missed_errors` climbing | NIC/driver can't sustain the interrupt load | Enable/raise interrupt coalescing, or replace the NIC |
| Aggregate collapses in the all-pairs test | Weak switch backplane | R1 — document it; it caps N7 |
| Link drops randomly | Marginal cable, loose connector, or a failing port | Replace cable, move port, log in RB-04 |
