# RB-04 — Switch or Link Failure

**Severity: HIGH.** The switch is the cluster's single point of failure — losing it takes
every node offline at once. This runbook is the plan for that.

---

## 1. Recognising it

| Symptom | Likely |
|---------|--------|
| **All** nodes unreachable at once, anchor is fine | Switch dead or unplugged |
| All nodes unreachable **and** the anchor is unreachable | Power failure in the room |
| One node unreachable | Not this runbook → [RB-02](RB-02-node-unreachable.md) |
| Several nodes on adjacent ports down | Partial switch failure / a bad port block |
| Everything intermittently dropping | Failing switch, bad power supply, or a loop |

---

## 2. Immediate triage (first 5 minutes)

```bash
# from anchor01
for i in 21 22 23 24 25; do
  ping -c1 -W1 10.42.0.$i >/dev/null && echo "UP   10.42.0.$i" || echo "DOWN 10.42.0.$i"
done

ping -c2 10.42.9.1        # is the switch management responding?
```

Then physically:

- [ ] Switch power LED on?
- [ ] Any port LEDs lit at all?
- [ ] Fan running / not overheating / not smelling burnt?
- [ ] Power cable and any uplink cable seated?

---

## 3. Contain the damage

Before fixing anything, stop the cluster from making it worse:

```bash
# drain all nodes so Slurm doesn't keep dispatching into a black hole
scontrol update NodeName=gpu[01-05] State=DRAIN Reason="RB-04 network outage"
```

Post in the team channel immediately — one message, plain and factual:

> ⚠️ ClusterOne network outage. All compute nodes are unreachable; investigating a switch
> failure. Running jobs are likely lost. Next update in 30 minutes.

Telling people early costs nothing. Silence during an outage costs a lot.

---

## 4. Recovery paths

### Path A — Power-cycle the switch (try first, 2 minutes)

```text
Unplug switch power → wait 30 s → plug back in → wait 60 s for boot
```

Then re-run the ping loop in §2. Roughly half of switch "failures" are a hung switch that
a power cycle fixes.

### Path B — Swap in the spare switch (15–30 minutes)

Prerequisite: a spare switch exists on the bench (an N0 shopping-list item — if there
isn't one, that's the lesson from this incident).

1. Move cables one at a time, **following `inventory/cable-map.md`** so port assignments
   are preserved.
2. If the spare is unmanaged: VLANs and jumbo frames are gone.
   - Set MTU back to 1500 cluster-wide, or verify the spare passes jumbo frames first
   - Expect degraded performance; record it
3. If the spare is managed: restore the config backup from
   `infrastructure/networking/switch/`.

```bash
# after the swap
for i in 21 22 23 24 25; do ping -c1 -W1 10.42.0.$i >/dev/null \
  && echo "UP $i" || echo "DOWN $i"; done
./scripts/iperf-matrix.sh anchor01 gpu01 gpu02 gpu03
ping -M do -s 8972 -c2 gpu01     # does jumbo still work on the spare?
```

### Path C — Degraded direct-connect (emergency, 2 nodes only)

If there is no switch at all and something must keep running, connect the anchor directly
to one compute node with a single cable (modern NICs auto-MDI-X, no crossover needed):

```bash
# anchor01
sudo ip addr add 10.42.0.10/24 dev eno2 && sudo ip link set eno2 up
# gpu01
sudo ip addr add 10.42.0.21/24 dev eno1 && sudo ip link set eno1 up
```

This is a demo-saving measure, not an operating mode. Document it and undo it.

---

## 5. Partial failure — a bad port block

Some ports work, others don't, and the pattern follows the port numbering:

1. Move an affected node's cable to a known-good port.
2. If it comes up, the port is dead → label it, note it in `cable-map.md`, avoid it.
3. If several adjacent ports are dead, the switch is failing → plan a replacement now,
   don't wait for it to fail completely.

---

## 6. After recovery

- [ ] `scontrol update NodeName=gpu[01-05] State=RESUME`
- [ ] `./scripts/netcheck.sh` on every node
- [ ] `./scripts/port-check.sh` → 100%
- [ ] `./scripts/iperf-matrix.sh` → compare against the N5 baseline; a spare switch will
      likely be slower, and that's fine as long as it's recorded
- [ ] Verify jumbo frames still pass — a replacement switch may not have it enabled
- [ ] Confirm all Prometheus targets are `up`
- [ ] Announce recovery, and say plainly which jobs were lost

---

## 7. Incident record

Write it in `reports/incidents.md` — short and factual:

```markdown
### YYYY-MM-DD — Switch failure
- Detected: HH:MM, by <who/what>
- Symptom: all 5 compute nodes unreachable, anchor fine
- Root cause: <e.g. switch PSU failure>
- Recovery: Path B, spare switch, restored HH:MM
- Downtime: N minutes
- Jobs lost: N
- Follow-up: <e.g. order a second spare; add a link-down alert>
```

---

## 8. Making this less likely

| Mitigation | Status | Notes |
|-----------|--------|-------|
| A spare switch on the bench | ⬜ | The single highest-value item on the N0 shopping list |
| Switch on a UPS | ⬜ | Cheap, and prevents brown-out damage |
| Switch config backed up in git | ⬜ | Makes Path B a 15-minute job instead of an hour |
| `up == 0` alert on all nodes at once | ⬜ | Detect in seconds, not when a user complains |
| Second switch + redundant links | ⬜ | The real fix. Out of scope for the pilot; note it as future work. |
