# Phase N0 — Requirements & Site Survey

> **Goal:** Know exactly what hardware, space, power and permissions exist — *before*
> buying a cable or typing an IP.

| | |
|---|---|
| **Duration** | 3–5 days (week 1) |
| **Entry condition** | Team formed, `abir/network` branch created |
| **Blocks** | N1 (nothing physical starts without this) |
| **Blocked by** | Node list from Rahat/Zafor; room + switch approval from the department |

---

## Why this phase exists

Every cluster disaster I could cause in week 6 is decided in week 1: the wrong switch,
a node with a NIC that can't sustain 1 Gb, no free power outlets, campus IT objecting to
a private switch. N0 is cheap. Discovering these in N7 is not.

---

## Tasks

### N0.1 — Node inventory

For every machine that will join ClusterOne, fill
[`templates/node-intake-form.md`](../templates/node-intake-form.md). Collect on each box:

```bash
# identity
hostnamectl
cat /sys/class/dmi/id/product_name

# CPU / RAM
lscpu | grep -E 'Model name|^CPU\(s\)|Thread|Socket'
free -h

# GPU
nvidia-smi --query-gpu=index,name,memory.total,driver_version,pci.bus_id --format=csv

# network interfaces — the important part
ip -br link
lspci | grep -i -E 'ethernet|network'
for i in $(ls /sys/class/net | grep -v lo); do
  echo "== $i"; sudo ethtool "$i" | grep -E 'Speed|Duplex|Link detected|Supported link modes'
done

# storage (staging capacity matters for the network plan)
lsblk -o NAME,SIZE,TYPE,MODEL,MOUNTPOINT
```

Record for each node: **NIC chipset and vendor**. `Realtek RTL8111` vs `Intel I219`
predicts whether R2 (packet loss under sustained load) will bite.

### N0.2 — Switch and cabling audit

Answer these, in writing:

- [ ] Managed or unmanaged? (VLANs and LACP require managed)
- [ ] Port count vs. node count + 4 spare
- [ ] Per-port speed: 100 Mb / 1 Gb / 2.5 Gb / 10 Gb
- [ ] Backplane / switching capacity — can it do full duplex on **all** ports at once?
- [ ] Jumbo frame support and the max MTU it accepts
- [ ] Management IP/credentials, firmware version
- [ ] Cable category available: Cat5e (1 Gb ok) / Cat6 (2.5–10 Gb) / Cat6a

> A cheap unmanaged 1 GbE switch with a weak backplane will show fine `iperf3` numbers
> pair-by-pair and collapse the moment three pairs run at once. Test that in N1.4.

### N0.3 — Site survey (physical)

- [ ] Room/lab identified; benches or rack available
- [ ] **Power**: total draw of N GPU PCs vs. circuit capacity; number of outlets; UPS?
- [ ] **Cooling / ventilation** — 5 GPU boxes in a closed room is a thermal problem
- [ ] Cable runs measured — cable length per node
- [ ] Physical security: who can walk up and unplug a node?
- [ ] Photo of the current state, committed to `docs/`

### N0.4 — Permissions and campus IT

- [ ] Written OK to run a **private switch** not managed by campus IT
- [ ] Written OK for the anchor's uplink port + whether campus does port-security/802.1X
- [ ] Is there a campus DHCP/DNS policy that could conflict? (Our fabric is private, so it shouldn't — confirm anyway.)
- [ ] Can the anchor get a stable campus IP / DNS name for the future web dashboard?
- [ ] Outbound rules: is `pip`/HuggingFace/apt reachable from that port, or is there a proxy?

Record who approved, on what date. This is the artifact that protects the project later.

### N0.5 — Requirements gathering from teammates

One short conversation each, recorded in the report:

| Ask | Person | What I need to hear |
|-----|--------|--------------------|
| "What port/protocol will the agent use?" | Tanvir | e.g. HTTPS POST to anchor:8000, or agent listens on 9500 |
| "Which Slurm ports and node naming?" | Rahat | `slurmctld` 6817, `slurmd` 6818, `SrunPortRange` |
| "Where does NFS live and how big are datasets?" | Shanto | anchor01 exports `/datasets`, ~200 GB |
| "Which exporters, which ports, what interval?" | Zafor | node_exporter 9100, dcgm 9400, 15 s |
| "Will you need multi-node in the pilot?" | Sadik Fahim | yes/no changes N7's priority a lot |

Anything they don't know yet becomes a **placeholder** in the port matrix with a TODO
and a name attached.

### N0.6 — Write the N0 report

Produce `infrastructure/networking/reports/N0-survey.md` containing:

1. Node inventory table (one row per machine)
2. Switch capability summary
3. Site constraints (power, cooling, space)
4. Approvals obtained, with dates
5. **Risk list with my recommendation for each** — especially R1 (unmanaged switch),
   R2 (weak NICs), R4 (campus IT)
6. A shopping list if anything is missing: Cat6 cables, Intel PCIe NICs, a managed switch

---

## Deliverables

- [ ] `inventory/nodes.csv` (or `.md`) — one row per node, machine-readable
- [ ] `reports/N0-survey.md`
- [ ] A draft `reference/ip-address-plan.md` with real node names filled in
- [ ] A draft `reference/port-matrix.md` with everyone's answers (or TODOs) from N0.5
- [ ] Shopping list, if any, sent to Zafor

---

## Exit gate

> **The inventory is complete for every node, all four approval questions in N0.3/N0.4
> are answered in writing, and the risk list has been reviewed with Zafor.**

Verify by: opening `reports/N0-survey.md` and finding zero cells marked "unknown" in the
inventory table. Unknowns are allowed only in the port matrix, and only with an owner
and a date attached.

---

## Common failure modes

| Trap | What it looks like later | Prevention |
|------|--------------------------|-----------|
| Trusting "it's gigabit" without `ethtool` | A node quietly negotiated 100 Mb/s and one job is 10× slow | N0.1 runs `ethtool` on every interface |
| Not counting outlets | Nodes get plugged into a daisy-chained strip and trip a breaker | N0.3 power check |
| Verbal permission only | Campus IT unplugs the switch in week 9 | Written approval with a date |
| Skipping N0.5 | Firewall ships in N4 without the agent's port; second PR needed | Placeholders with owners |
