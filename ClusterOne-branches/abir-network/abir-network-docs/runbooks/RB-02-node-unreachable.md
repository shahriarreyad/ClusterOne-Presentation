# RB-02 — A Node Is Unreachable

**Symptoms:** `ping gpuNN` fails · Slurm shows the node `DOWN`/`DRAIN` · Prometheus target
`up == 0` · the agent stopped reporting.

**Goal:** find the layer that's broken in under 10 minutes, and either fix it or hand it
to the right person.

---

## The decision tree

Work **bottom-up**. Layer 1 first, always — it's the fastest to check and the most common
cause.

```text
START: gpuNN is unreachable
   │
   ├─ Is the machine physically powered on?  (look at it / check the power LED)
   │     NO  → power it on. Done.
   │     YES ↓
   │
   ├─ Is the NIC link LED lit at both the node and the switch port?
   │     NO  → LAYER 1 → Section A
   │     YES ↓
   │
   ├─ Can you ping its IP directly?   ping 10.42.0.NN
   │     YES → it's NAME RESOLUTION → Section C
   │     NO  ↓
   │
   ├─ Does its ARP entry resolve?     ip neigh show 10.42.0.NN
   │     "FAILED"/absent → LAYER 2/3 → Section B
   │     has a MAC       ↓
   │
   ├─ Can you SSH in (or reach the console)?
   │     NO  → the host itself is down/hung → Section D
   │     YES ↓
   │
   └─ Host is up, network is up → it's a SERVICE problem → Section E
```

---

## Section A — Layer 1 (cable / port / NIC)

```bash
# on the node, if you can reach a console
sudo ethtool <iface> | grep -E 'Link detected|Speed|Duplex'
ip -br link
```

| Finding | Action |
|---------|--------|
| `Link detected: no` | Reseat both ends → swap the cable → move to a different switch port |
| Interface `DOWN` | `sudo ip link set <iface> up` — then find out why it was down |
| Interface missing entirely | Driver/hardware problem: `lspci \| grep -i ethernet`, `dmesg \| grep -i eth` |
| Speed dropped to 100 Mb | Bad cable or damaged port — replace |

If a cable swap and a port change both fail → the NIC is suspect → escalate to Abir.

---

## Section B — Layer 2/3 (addressing)

```bash
# from anchor01
ip neigh show 10.42.0.NN         # is there an ARP entry?
arping -I eno2 -c3 10.42.0.NN    # does anything answer at that address?

# on the node (console)
ip -br addr                      # does it have the right IP?
ip route                         # is the route sane?
sudo netplan get                 # what config is actually loaded?
```

| Finding | Cause | Fix |
|---------|-------|-----|
| No IP on the interface | netplan didn't apply, or a cloud-init file is overriding it | `sudo netplan apply`; remove `50-cloud-init.yaml` |
| Wrong IP (e.g. `10.42.0.2xx`) | It fell back to the DHCP staging pool | The static config isn't loading — check the netplan file exists and is `600` |
| Duplicate address warning | Two nodes share an IP | Check the address plan; someone deviated from it |
| IP correct but no ARP reply | Firewall dropped ICMP, or wrong VLAN on the switch port | `nft list ruleset`; verify the port's VLAN |

---

## Section C — Name resolution

The IP works but the name doesn't:

```bash
getent hosts gpuNN
dig +short gpuNN.clusterone.internal @10.42.0.10
grep gpuNN /etc/hosts
systemctl status dnsmasq        # on anchor01
```

| Finding | Fix |
|---------|-----|
| Missing from `/etc/hosts` | Regenerate and re-push the hosts block (RB-01 Step 5) |
| dnsmasq is down | `sudo systemctl restart dnsmasq`; check `journalctl -u dnsmasq` |
| Resolves on some nodes, not others | The hosts push didn't reach everyone — re-run the playbook |
| `dig` works, `ping gpuNN` doesn't | The `search` domain is missing from that node's netplan |

---

## Section D — Host is down or hung

```bash
ping 10.42.0.NN                 # responds?
nc -z -w2 10.42.0.NN 22         # SSH port open?
```

If the network layer answers (ARP resolves, ping works) but SSH doesn't:

1. Try the physical console — is there a kernel panic, a full disk, or an OOM?
2. `journalctl -b -1 -p err` after it comes back — what happened before it died?
3. Common causes on GPU nodes: **thermal shutdown**, out-of-memory kill, a full `/`,
   or a GPU driver crash taking the box with it.

Recovery:

```bash
# drain first so Slurm stops sending it work
scontrol update NodeName=gpuNN State=DRAIN Reason="RB-02 investigation"
# after the fix
scontrol update NodeName=gpuNN State=RESUME
```

---

## Section E — Host up, network up, service down

Network is fine; a specific service isn't answering. **This is no longer a network
problem** — route it to the owner.

```bash
ssh gpuNN 'systemctl status slurmd clusterone-agent node_exporter'
ssh gpuNN 'ss -tulpn | grep -E "6818|9500|9100"'
```

| Not listening | Owner |
|---------------|-------|
| `slurmd` (6818) | Rahat |
| ClusterOne agent (9500) | Tanvir |
| `node_exporter` (9100) | Zafor |
| NFS mount hung | Shanto (but check MTU/network first — see below) |

**Stale NFS handle** — common after a network blip:
```bash
sudo umount -f -l /mnt/datasets
sudo mount -a
```

---

## After recovery — always

- [ ] `./scripts/netcheck.sh` on the node → all green
- [ ] `./scripts/port-check.sh gpuNN` → 100%
- [ ] `scontrol update NodeName=gpuNN State=RESUME`
- [ ] Confirm the Prometheus target is `up` again
- [ ] **Write down the root cause** in `reports/incidents.md` — one line: date, node,
      symptom, cause, fix. Three entries with the same cause means it needs a real fix,
      not a repeated workaround.

---

## Fast reference

```bash
ip -br link                 # is the link up
ethtool eno1                # what speed did it actually negotiate
ip -br addr                 # does it have the right address
ip neigh show               # ARP table
ip route                    # routing table
getent hosts gpuNN          # name resolution
nft list ruleset            # is the firewall the culprit
ss -tulpn                   # what's listening
journalctl -u ssh -n 50     # why SSH refused
dmesg -T | tail -50         # hardware/driver events
```
