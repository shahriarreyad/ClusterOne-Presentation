# Phase N2 — Addressing, Hostnames & DNS

> **Goal:** Every node has a permanent, predictable IP and answers to a short name from
> anywhere in the cluster — including after a reboot and including if DNS is down.

| | |
|---|---|
| **Duration** | 3–4 days (week 2) |
| **Entry condition** | N1 signed off — all links up at full speed |
| **Blocks** | N3, and Tanvir's agent registration, and Rahat's node table |
| **Blocked by** | Nothing (once N1 is done) |

---

## Why this phase exists

This phase produces the single most-referenced artifact of the whole module:
[`reference/ip-address-plan.md`](../reference/ip-address-plan.md). Every other teammate
will read it. Slurm's `slurm.conf`, the agent's config, NFS exports, Prometheus targets —
all of them point at names and addresses decided here.

Get it right once and nobody thinks about it again. Get it wrong and every module needs
a fix-up PR in week 8.

---

## Tasks

### N2.1 — Freeze the address plan

Fill in [`reference/ip-address-plan.md`](../reference/ip-address-plan.md) with real nodes.
The rule:

```text
gpuNN  →  10.42.0.(20 + NN)

gpu01 → 10.42.0.21
gpu02 → 10.42.0.22
gpu05 → 10.42.0.25
```

Announce the frozen plan to the team. From this point, changes require a PR and a heads-up
in the team channel.

### N2.2 — Set hostnames

On each machine:

```bash
sudo hostnamectl set-hostname gpu01
```

Naming rules (full detail in [`reference/naming-convention.md`](../reference/naming-convention.md)):

- lowercase, no underscores (DNS-hostile), zero-padded index: `gpu01`, not `GPU_1`
- controller is `anchor01` — leaves room for `anchor02` in an HA future
- FQDN is `gpu01.clusterone.internal`
- `hostname -s` must return the short name Slurm will use — Slurm is picky about this

### N2.3 — Static IP configuration with netplan

Ubuntu 22.04+. Files go in git at `infrastructure/networking/netplan/`, then are copied
into place by Ansible — never typed by hand on the box.

**Compute node** — `/etc/netplan/01-clusterone.yaml`:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eno1:
      dhcp4: no
      addresses: [10.42.0.21/24]        # gpu01
      mtu: 9000
      routes:
        - to: default
          via: 10.42.0.10               # anchor NAT gateway (see ADR-N6)
      nameservers:
        addresses: [10.42.0.10]
        search: [clusterone.internal]
```

**Anchor node** — `/etc/netplan/01-clusterone.yaml`:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eno1:                                # campus uplink — keep 1500
      dhcp4: yes
      mtu: 1500
    eno2:                                # cluster fabric
      dhcp4: no
      addresses: [10.42.0.10/24]
      mtu: 9000
      # no default route here — the campus NIC owns the default route
```

Apply safely (this is the command that saves you from locking yourself out):

```bash
sudo netplan try        # auto-reverts after 120 s if you don't confirm
sudo netplan apply
```

> **Never run `netplan apply` blind over SSH on a remote node.** `netplan try` first,
> every time. If you do lock yourself out, RB-02 covers recovery.

### N2.4 — Generate `/etc/hosts` (layer 1)

`/etc/hosts` is generated from the address plan, not hand-edited.
`infrastructure/networking/dns/hosts.generate.sh`:

```bash
#!/usr/bin/env bash
# Generate the ClusterOne block for /etc/hosts from nodes.csv
# nodes.csv format: shortname,ip
set -euo pipefail
SRC="${1:-inventory/nodes.csv}"
DOMAIN="clusterone.internal"

echo "# --- BEGIN CLUSTERONE (generated, do not edit) ---"
while IFS=, read -r name ip; do
  [[ "$name" =~ ^#|^$ ]] && continue
  printf '%-15s %-32s %s\n' "$ip" "${name}.${DOMAIN}" "$name"
done < "$SRC"
echo "# --- END CLUSTERONE ---"
```

Push the block to every node with Ansible's `blockinfile` (idempotent, replaces cleanly
on the next node addition — this is exactly why the BEGIN/END markers exist).

### N2.5 — dnsmasq on the anchor (layer 2)

`/etc/dnsmasq.d/clusterone.conf` on `anchor01`:

```conf
# serve only on the fabric interface
interface=eno2
bind-interfaces
listen-address=10.42.0.10

# our internal zone, resolved from /etc/hosts on the anchor
domain=clusterone.internal
local=/clusterone.internal/
expand-hosts

# forward everything else upstream (campus resolvers)
# server=<campus-dns-1>
# server=<campus-dns-2>

# staging pool for unprovisioned nodes (N2.6)
dhcp-range=10.42.0.200,10.42.0.250,12h

# never hand out addresses in the static range
dhcp-ignore-names
```

```bash
sudo systemctl enable --now dnsmasq
sudo systemctl status dnsmasq
```

If `systemd-resolved` is holding port 53 on the anchor, disable its stub listener
(`DNSStubListener=no` in `/etc/systemd/resolved.conf`) before starting dnsmasq. This is
the single most common dnsmasq failure on Ubuntu.

### N2.6 — DHCP staging pool

`10.42.0.200–250` exists so a brand-new, unconfigured node can boot, get an address,
be reachable, and then be provisioned into its static address. It is a **staging area,
not a home**. Nothing runs long-term on a `.200+` address.

### N2.7 — Verify

```bash
# from every node, to every node — by SHORT name
for h in anchor01 gpu01 gpu02 gpu03 gpu04 gpu05; do
  ping -c1 -W1 "$h" >/dev/null && echo "OK   $h" || echo "FAIL $h"
done

# name resolution comes out where expected
getent hosts gpu02
dig +short gpu02.clusterone.internal @10.42.0.10

# the node knows its own identity
hostname -s ; hostname -f ; hostname -I

# routes are what I designed
ip route show
```

Then **reboot every node** and run it all again. A config that only works until the next
boot is not done.

---

## Deliverables

- [ ] `reference/ip-address-plan.md` — frozen and announced
- [ ] `reference/naming-convention.md` — finalised
- [ ] `infrastructure/networking/netplan/*.yaml` — one per node, in git
- [ ] `infrastructure/networking/dns/hosts.generate.sh` + generated block
- [ ] `infrastructure/networking/dns/clusterone.conf` (dnsmasq)
- [ ] `reports/N2-addressing.md` — the full ping matrix, before and after reboot

---

## Exit gate

> **From every node, `ping -c1 <shortname>` succeeds for every other node — after a
> full cluster reboot — and `hostname -s` on each machine matches the address plan
> exactly.**

Produce an N×N ping matrix in the report. Every cell must be OK.

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ping gpu02` fails, `ping 10.42.0.22` works | Name resolution — hosts block missing or dnsmasq down | Re-push the hosts block; check `systemctl status dnsmasq` |
| Node reachable, then gone after reboot | netplan file not applied / left in `/etc/netplan` alongside a conflicting cloud-init file | Remove `50-cloud-init.yaml` or disable cloud-init networking |
| Two nodes fight over one IP | Address plan not followed, or a stale DHCP lease | `arping -D` to detect; fix the plan violation |
| dnsmasq won't start, "address already in use" | `systemd-resolved` owns :53 | `DNSStubListener=no`, restart resolved, then dnsmasq |
| `hostname -f` returns `localhost` | `/etc/hosts` puts the hostname on the `127.0.1.1` line only | Ensure the fabric IP line carries FQDN + short name |
| Slurm later says "unknown node" | `hostname -s` ≠ the name in `slurm.conf` | These must match exactly — that's why N2.2 pins it |
