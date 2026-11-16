# Phase N4 — Service Connectivity & Firewall

> **Goal:** Every port ClusterOne's services need is proven open between exactly the
> right pairs of machines — and everything else is denied by default.

| | |
|---|---|
| **Duration** | 4–6 days (week 4–5) |
| **Entry condition** | N3 signed off (Milestone 1) |
| **Blocks** | Rahat's Slurm, Tanvir's agent, Shanto's NFS, Zafor's scraping |
| **Blocked by** | Final port answers from Rahat / Tanvir / Zafor (asked in N0.5) |

---

## Why this phase exists

Up to now the fabric is wide open — fine for bring-up, wrong for anything else. This
phase does two things at once:

1. **Guarantee** the services can talk (the allowlist).
2. **Guarantee** nothing else can (the default deny).

Doing it now, before four teammates deploy their services, means their first deploy lands
on a network that already behaves like production. Retrofitting a firewall in week 10
means four people debugging "it worked yesterday" at the same time.

---

## Tasks

### N4.1 — Finalise the port matrix

Complete [`reference/port-matrix.md`](../reference/port-matrix.md). Every row needs a
real owner and no TODOs. The pilot set:

| Service | Port(s) | Proto | From → To | Owner |
|---------|---------|-------|-----------|-------|
| SSH | 22 | TCP | any fabric → any fabric | Abir |
| slurmctld | 6817 | TCP | gpuNN → anchor01 | Rahat |
| slurmd | 6818 | TCP | anchor01 → gpuNN | Rahat |
| slurmdbd | 6819 | TCP | anchor01 → anchor01 | Rahat |
| srun/step ports | 60001–63000 | TCP | gpuNN ⇄ gpuNN, anchor01 ⇄ gpuNN | Rahat |
| ClusterOne agent | 9500 (TBC) | TCP | anchor01 ⇄ gpuNN | Tanvir |
| Backend API | 8000 | TCP | fabric → anchor01 | Rahat |
| Web / dashboard | 443, 80 | TCP | campus → anchor01 only | Rahat/Sadik |
| NFS | 2049 | TCP | gpuNN → storage host | Shanto |
| rpcbind | 111 | TCP+UDP | gpuNN → storage host | Shanto |
| mountd (pinned) | 20048 | TCP+UDP | gpuNN → storage host | Shanto |
| node_exporter | 9100 | TCP | anchor01 → gpuNN | Zafor |
| dcgm-exporter | 9400 | TCP | anchor01 → gpuNN | Zafor |
| Prometheus | 9090 | TCP | localhost/anchor only | Zafor |
| Grafana | 3000 | TCP | campus → anchor01 | Zafor |
| DNS | 53 | TCP+UDP | gpuNN → anchor01 | Abir |
| NTP | 123 | UDP | gpuNN → anchor01 | Abir |
| **NCCL rendezvous** | 29400–29600 | TCP | gpuNN ⇄ gpuNN | Fahim |
| **NCCL data** | ephemeral (32768–60999) | TCP | gpuNN ⇄ gpuNN | Fahim |
| ICMP | — | ICMP | fabric-wide | Abir |

> Pin NFS's `mountd` to a fixed port (`/etc/nfs.conf` → `[mountd] port=20048`) —
> otherwise it lands on a random port and no static firewall rule can ever match it.
> Tell Shanto this in N4.1, not in N6 when it breaks.

### N4.2 — Time sync (small task, large consequences)

Slurm, NFS `mtime`, distributed job coordination and log correlation all break subtly
when clocks drift.

```bash
# anchor01 — chrony server for the fabric
sudo apt install -y chrony
# /etc/chrony/chrony.conf
#   pool <campus-ntp> iburst
#   allow 10.42.0.0/24
#   local stratum 10           # keep serving if campus NTP is unreachable

# compute nodes
#   server anchor01 iburst
#   (remove the public pool lines — they have no internet route by design)
```

Verify: `chronyc sources -v` and `chronyc tracking` on each node; offsets under a few ms.

### N4.3 — NAT egress on the anchor (ADR-N6)

```bash
# /etc/sysctl.d/99-clusterone.conf
net.ipv4.ip_forward = 1
sudo sysctl --system
```

nftables NAT on `anchor01`:

```nft
table inet clusterone_nat {
  chain postrouting {
    type nat hook postrouting priority srcnat;
    ip saddr 10.42.0.0/24 oifname "eno1" masquerade
  }
}
```

Verify from a compute node: `curl -I https://pypi.org` succeeds and `ip route get 8.8.8.8`
shows the anchor as the next hop. N8 narrows this to an allowlist.

### N4.4 — nftables ruleset — compute node

`infrastructure/networking/firewall/compute.nft`:

```nft
#!/usr/sbin/nft -f
flush ruleset

define FABRIC  = 10.42.0.0/24
define ANCHOR  = 10.42.0.10

table inet clusterone {
  chain input {
    type filter hook input priority filter; policy drop;

    iif lo accept
    ct state established,related accept
    ct state invalid drop

    # ICMP — never block it on a cluster; it is the primary diagnostic
    ip protocol icmp accept
    ip6 nexthdr ipv6-icmp accept

    # management
    ip saddr $FABRIC tcp dport 22 accept comment "ssh"

    # slurm: controller drives slurmd here
    ip saddr $ANCHOR tcp dport 6818 accept comment "slurmd"
    ip saddr $FABRIC tcp dport 60001-63000 accept comment "srun steps"

    # clusterone agent
    ip saddr $ANCHOR tcp dport 9500 accept comment "agent"

    # monitoring exporters — anchor scrapes only
    ip saddr $ANCHOR tcp dport { 9100, 9400 } accept comment "exporters"

    # distributed training, node to node only
    ip saddr $FABRIC tcp dport 29400-29600 accept comment "nccl rendezvous"
    ip saddr $FABRIC tcp dport 32768-60999 accept comment "nccl data"

    # log what we drop, rate-limited so a scan can't fill the disk
    limit rate 5/minute log prefix "nft-drop-in: " level info
  }

  chain forward { type filter hook forward priority filter; policy drop; }
  chain output  { type filter hook output  priority filter; policy accept; }
}
```

### N4.5 — nftables ruleset — anchor node

Same skeleton, different allowlist, and one critical extra rule: the campus-facing
interface exposes **only** 22, 443 and 3000 — never 6817, never 9090, never the fabric
services.

```nft
  chain input {
    type filter hook input priority filter; policy drop;
    iif lo accept
    ct state established,related accept
    ip protocol icmp accept

    # from the fabric
    iifname "eno2" ip saddr $FABRIC tcp dport { 22, 6817, 6819, 8000, 53 } accept
    iifname "eno2" ip saddr $FABRIC udp dport { 53, 123 } accept
    iifname "eno2" ip saddr $FABRIC tcp dport { 2049, 111, 20048 } accept
    iifname "eno2" ip saddr $FABRIC udp dport { 111, 20048 } accept

    # from campus — the public face, deliberately tiny
    iifname "eno1" tcp dport { 22, 443, 3000 } accept

    limit rate 5/minute log prefix "nft-drop-in: " level info
  }
```

Deploy carefully — the same lock-yourself-out risk as netplan:

```bash
sudo nft -c -f compute.nft          # syntax check only, changes nothing
sudo nft -f compute.nft
sudo nft list ruleset > /etc/nftables.conf
sudo systemctl enable nftables
```

Keep a console/physical fallback available while doing this the first time.

### N4.6 — Verify with `port-check.sh`

Write [`scripts/port-check.sh`](../scripts/port-check.sh) to walk the matrix and assert
both directions of the contract:

```bash
# every row that should be OPEN
nc -z -w2 anchor01 6817 && echo "OK   slurmctld"

# and a NEGATIVE test — this is the half people skip
nc -z -w2 gpu01 9090 && echo "FAIL prometheus reachable from a node!" \
                     || echo "OK   prometheus correctly blocked"
```

A firewall that only proves what's open is half-tested. **Every phase-N4 report must
contain negative tests.**

---

## Deliverables

- [ ] `reference/port-matrix.md` — complete, no TODOs, owners named
- [ ] `infrastructure/networking/firewall/{compute.nft,anchor.nft,POLICY.md}`
- [ ] chrony configs for anchor + compute
- [ ] NAT rule + `sysctl` config
- [ ] `scripts/port-check.sh` with positive **and** negative assertions
- [ ] `reports/N4-connectivity.md` — full pass/fail table

---

## Exit gate

> **`scripts/port-check.sh` reports 100% pass across the whole matrix — including every
> negative test — from every node, and survives a reboot of the whole cluster.**

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Slurm nodes stuck in `DOWN` | 6817/6818 blocked one way | The two ports go in **opposite** directions — check both |
| NFS mount hangs forever | `mountd` on a random port | Pin it to 20048 in `/etc/nfs.conf` and allow it |
| Prometheus target `context deadline exceeded` | 9100/9400 blocked to anchor | Allow only from `$ANCHOR`, not the whole fabric |
| DDP hangs at init | NCCL ephemeral ports blocked | Allow 32768–60999 between fabric nodes |
| Firewall rules vanish after reboot | Never persisted | `nft list ruleset > /etc/nftables.conf` + enable the unit |
| Locked out of a node | Applied a `policy drop` without an SSH accept rule | `nft -c -f` first; keep a console open |
| `apt`/`pip` broken on nodes | NAT or DNS missing | `ip route get 8.8.8.8`, then `dig @10.42.0.10 pypi.org` |
