# 01 — Network Architecture

The design I am building toward. Every phase in `02-phase-plan.md` moves the real
network one step closer to this picture.

---

## 1. Design principles

1. **The cluster fabric is private and isolated.** It is not the campus LAN. Compute
   nodes have no default route to the internet; the anchor node is the only door.
2. **Deterministic addressing.** Static IPs derived from the hostname. `gpu03` is
   always `10.42.0.23`. No DHCP lottery, ever, on the fabric.
3. **Name-first, IP-never.** Nothing in ClusterOne code hardcodes an IP. Everything
   uses hostnames. That is what lets me re-address the cluster without breaking Rahat's backend.
4. **Default deny.** Host firewall denies inbound by default; the port matrix is the
   only allowlist.
5. **One fabric now, room for a fast fabric later.** The design reserves a second
   subnet/VLAN so a 10/25 GbE upgrade for distributed training drops in without a redesign.
6. **Every claim is measured.** No performance statement without an `iperf3` or
   `nccl-tests` number and a date.

---

## 2. Target topology (pilot: 1 anchor + 5 compute nodes)

```text
                        ┌───────────────────────────┐
                        │   DIU Campus Network      │
                        │   (uplink, DHCP, IdP)     │
                        └────────────┬──────────────┘
                                     │  eno1 (campus, DHCP)
                                     │
                        ┌────────────┴──────────────┐
                        │        anchor01           │
                        │  Controller / Head Node   │
                        │                           │
                        │  eno1 → campus  (uplink)  │
                        │  eno2 → 10.42.0.10 fabric │
                        │                           │
                        │  slurmctld · API · NFS    │
                        │  dnsmasq · Prometheus     │
                        └────────────┬──────────────┘
                                     │ VLAN 42 · MTU 9000
                        ┌────────────┴──────────────┐
                        │   ClusterOne Switch SW01  │
                        │   managed, 1 GbE (pilot)  │
                        └─┬────┬────┬────┬────┬─────┘
                          │    │    │    │    │
              ┌───────────┘    │    │    │    └───────────┐
              ↓                ↓    ↓    ↓                ↓
          ┌────────┐     ┌────────┐  ┌────────┐     ┌────────┐
          │ gpu01  │     │ gpu02  │  │ gpu03  │ ... │ gpu05  │
          │.42.0.21│     │.42.0.22│  │.42.0.23│     │.42.0.25│
          │ RTX30xx│     │ RTX30xx│  │ RTX30xx│     │ RTX40xx│
          │ slurmd │     │ slurmd │  │ slurmd │     │ slurmd │
          │ agent  │     │ agent  │  │ agent  │     │ agent  │
          └────────┘     └────────┘  └────────┘     └────────┘

     No compute node has a campus-facing interface.
     All outbound (apt, pip, HF datasets) goes through anchor01 or a proxy — see §6.
```

---

## 3. Network segments

| Segment | Name | Subnet | VLAN | MTU | Purpose |
|---------|------|--------|------|-----|---------|
| Campus uplink | `net-campus` | DIU-assigned, DHCP | — | 1500 | Anchor only. Users, OIDC, package mirrors. |
| **Cluster fabric** | `net-cluster` | `10.42.0.0/24` | 42 | **9000** | Everything internal: Slurm, agent, NFS, scrape, SSH. |
| Fast fabric (reserved) | `net-fast` | `10.42.1.0/24` | 43 | 9000 | Future 10/25 GbE for NCCL only. Not built in the pilot. |
| Switch management | `net-oob` | `10.42.9.0/29` | 9 | 1500 | Switch web/CLI. Reachable from anchor only. |
| BMC / IPMI (if any) | `net-bmc` | `10.42.9.8/29` | 9 | 1500 | Out-of-band power control. Optional. |

> **Why `10.42.0.0/24` and not `192.168.1.0/24`?** Campus and home routers live in
> `192.168.x` and `10.0.0.x`. Picking an unusual, memorable block removes any chance of
> a route collision when a node is also plugged into campus for provisioning.

---

## 4. Per-node interface layout

**Anchor node (`anchor01`)** — dual NIC, mandatory:

```text
eno1  → campus       DHCP or campus-static, default route, MTU 1500
eno2  → net-cluster  10.42.0.10/24, no gateway, MTU 9000
```

**Compute node (`gpuNN`)** — single NIC in the pilot:

```text
eno1  → net-cluster  10.42.0.<20+NN>/24, MTU 9000
        gateway: 10.42.0.10 (anchor, only if outbound is enabled — see §6)
        DNS:     10.42.0.10
```

**Compute node after a bonding upgrade (N7 option B):**

```text
eno1 + enp3s0  → bond0 (802.3ad LACP, xmit_hash_policy=layer3+4)
bond0          → 10.42.0.<20+NN>/24, MTU 9000, ~2 Gbit/s aggregate
```

Bonding only helps when there are **multiple concurrent flows** — a single TCP stream
still rides one link. NCCL with multiple channels does open multiple sockets, so this is
worth measuring in N7, but it is not a free 2×.

---

## 5. Name resolution design

Two layers, deliberately redundant:

```text
        ┌──────────────────────────────────────────┐
        │ Layer 1: /etc/hosts on every node        │
        │  - generated from reference/ip-address-plan.md
        │  - survives dnsmasq being down            │
        │  - the bootstrap source of truth          │
        └──────────────────┬───────────────────────┘
                           │
        ┌──────────────────┴───────────────────────┐
        │ Layer 2: dnsmasq on anchor01             │
        │  - serves clusterone.internal             │
        │  - forwards everything else upstream      │
        │  - one place to add a node                │
        └──────────────────────────────────────────┘
```

`/etc/hosts` is generated, never hand-edited — see N2. Hand-editing it on 6 machines is
how clusters get a node that only half the cluster can see.

Details: [`reference/naming-convention.md`](reference/naming-convention.md).

---

## 6. Outbound internet policy (a real decision, not a detail)

Compute nodes need `apt`, `pip`, and dataset downloads. Three options:

| Option | How | Verdict |
|--------|-----|---------|
| **A. No outbound** | Nodes are fully isolated; images built on anchor and pushed | Safest, most painful. Blocks students constantly. |
| **B. NAT via anchor** ✅ | `anchor01` does NAT for `10.42.0.0/24`, with an egress allowlist | **Chosen for the pilot.** One controlled door, easy to log and to close. |
| **C. Campus DHCP on every node** | Every node dual-homed to campus | Rejected — destroys isolation, invites campus policy conflicts, breaks determinism. |

**Decision: Option B.** Implemented in N4, tightened to an allowlist in N8.
Egress is a privilege the network grants, not a property nodes have by default.

---

## 7. Traffic classes on the fabric

Understanding what shares the wire is what makes N5/N7 tuning meaningful.

| Class | Typical size | Pattern | Sensitive to | Owner |
|-------|-------------|---------|--------------|-------|
| Control (Slurm, agent heartbeat, API) | bytes–KB | constant, tiny | **latency**, never bandwidth | Rahat, Tanvir |
| Monitoring scrape | KB | every 15 s | latency | Zafor |
| Storage / NFS | MB–GB | bursty, large reads | **bandwidth**, MTU | Shanto |
| Dataset staging | GB | huge one-shot bursts | bandwidth | Shanto |
| **NCCL all-reduce** | MB per step, thousands of steps | **bulk + latency-critical, synchronous** | both, brutally | Sadik Fahim |

The conflict to design around: **dataset staging can starve NCCL.** Two mitigations,
both in N7: stage datasets to node-local NVMe *before* the training step (already the
project's storage policy), and put NCCL on a separate fabric/VLAN once `net-fast` exists.

---

## 8. Failure domains

| If this dies | Blast radius | Mitigation |
|--------------|--------------|------------|
| Switch SW01 | **Entire cluster** | Documented single point of failure in the pilot. Keep a spare switch on the bench. RB-04. |
| `anchor01` fabric NIC | Entire cluster loses control plane | Second NIC held as cold spare; `/etc/hosts` keeps node↔node alive so running jobs survive |
| dnsmasq | Nothing immediately | `/etc/hosts` fallback layer — this is exactly why layer 1 exists |
| One node's NIC | That node only | Slurm drains the node; RB-02 |
| One cable | One node | Labelled cables + spare patch leads |

---

## 9. Architecture decision record (ADR)

| # | Decision | Alternatives rejected | Rationale |
|---|----------|----------------------|-----------|
| ADR-N1 | Private isolated fabric `10.42.0.0/24`, separate switch | Campus VLAN | Determinism, no campus policy conflicts, no DHCP drift |
| ADR-N2 | Static IPs derived from hostname index | DHCP reservations | Works even if anchor is down; readable; trivially scriptable |
| ADR-N3 | `/etc/hosts` + dnsmasq, both | DNS only | DNS outage must not take down the cluster |
| ADR-N4 | MTU 9000 on fabric | 1500 everywhere | ~6× fewer packets/interrupts for NFS + NCCL bulk transfer |
| ADR-N5 | `nftables` default-deny on all nodes | ufw / no firewall | ufw wraps iptables; nftables is the modern default on Ubuntu 22.04+ and is scriptable per-role |
| ADR-N6 | NAT egress through anchor | Direct campus per node | One auditable door; matches project's security section |
| ADR-N7 | Key-only SSH + node↔node host-based trust | Passwords, per-user manual keys | Required by Slurm/MPI/DDP launcher; passwords cannot survive a 14-person team |
| ADR-N8 | Reserve VLAN 43 / `10.42.1.0/24` for a fast fabric | Re-plan later | A later 25 GbE upgrade becomes a cabling job, not a redesign |

Any change to these is a PR that updates this table with a date and a reason.
