# 00 — Role Charter: Networking (Abir, CSE Tech)

The scope contract. If something is not in the **In Scope** table, it is not my ticket —
I support it, I don't own it.

---

## 1. Assignment (from `ClusterOne_Team_Assignment.md`)

> **12 | Abir (CSE Tech) | 🌐 Networking**
> Node-to-node networking · IP configuration · Hostnames · SSH · Network topology ·
> Switch configuration · Network testing · Distributed AI network requirements
>
> Folder ownership: `infrastructure/`

Development order places me in **Step 2 — Foundations**, running in parallel with Shanto
(storage), Tanvir (agent), Sourav Kundu (database) and Rahat (core backend).

**I am on the critical path.** Everyone in Step 3 onward is blocked until N3 is done.

---

## 2. In scope — what I own

| # | Area | Concretely means |
|---|------|------------------|
| 1 | **Physical layer** | Switch, cables, ports, link speed/duplex, cable labelling, rack/bench layout |
| 2 | **L2 design** | VLANs, jumbo frames (MTU 9000), NIC bonding/LACP, spanning-tree sanity |
| 3 | **L3 addressing** | Subnet plan, static IP assignment, gateway/route policy, no-DHCP-drift guarantee |
| 4 | **Name resolution** | Hostnames, FQDNs, `/etc/hosts` generation, `dnsmasq` on the anchor node |
| 5 | **SSH & access** | Key policy, `sshd_config` baseline, node↔node passwordless trust, known_hosts distribution |
| 6 | **Reachability** | Every service port in `reference/port-matrix.md` proven open between the right pairs |
| 7 | **Host firewall** | `nftables` policy on anchor + compute nodes, default-deny with an explicit allowlist |
| 8 | **Performance** | Bandwidth matrix, latency matrix, MTU verification, retransmit/error counters |
| 9 | **Distributed AI fabric** | Interface selection for NCCL, MTU, bonding, `NCCL_SOCKET_IFNAME`, all-reduce benchmark |
| 10 | **Network monitoring inputs** | Expose interface/link metrics so Zafor can graph them; define the network alerts |
| 11 | **Network docs & runbooks** | Everything in this folder + `infrastructure/networking/` |

---

## 3. Out of scope — what I explicitly do NOT own

| Not mine | Owner | My involvement |
|----------|-------|----------------|
| Slurm install/config | Rahat | I open the ports (6817/6818/60001–63000) and prove reachability |
| NFS server, exports, ZFS | Shanto | I provide the path, tune MTU/`rsize`-relevant network side, verify throughput |
| Prometheus/Grafana | Zafor | I open 9100/9400/9090, feed him network metric names and alert thresholds |
| Node agent code | Tanvir | I guarantee the transport; he picks the protocol/port and I add it to the matrix |
| Backend API / auth | Rahat, Irfanur | I expose 8000/443 to the right segment only |
| PyTorch DDP code | Sadik Fahim | I deliver a tuned fabric + a measured all-reduce baseline he can trust |
| Apptainer images | Tanjimul | I define what container networking mode is allowed and why |
| University AD / OIDC | Irfanur | I keep the uplink route to campus IdP reachable from the anchor only |
| Application-level security | Irfanur, Zafor | I own network-level segmentation and the host firewall |

> If a bug is "the port is closed / the route is wrong / the name doesn't resolve /
> the link is slow" → **mine**.
> If a bug is "the service crashed / the config is wrong / the code returns 500" → **not mine**.
> Runbook `RB-02` and `RB-03` exist to make that triage decision fast.

---

## 4. Definition of Done for the whole module

The networking module is done when **all nine** of these are true:

1. Any node can resolve and reach any other node by short hostname, from a cold boot,
   with no manual step.
2. IP assignment is deterministic and documented; a rebuilt node comes back with the
   same address.
3. `ssh <node>` is passwordless and key-only in every direction the cluster needs;
   password auth is disabled cluster-wide.
4. Every port in `reference/port-matrix.md` is verified open where it must be and
   **closed everywhere else** — proven by `scripts/port-check.sh`.
5. A published bandwidth + latency matrix exists for all node pairs, with a stated
   pass threshold, and the current numbers pass it.
6. Jumbo frames are enabled and verified end-to-end on the cluster fabric
   (`ping -M do -s 8972` succeeds between every pair).
7. A NCCL all-reduce benchmark across ≥2 nodes runs and its bus-bandwidth number is
   recorded, with an honest statement of what the current fabric can and cannot support.
8. Four runbooks exist and have each been dry-run at least once by someone who is not me.
9. Zafor has merged the final `abir/network` PR into `develop` and the phase sign-off
   sheets are all filled.

---

## 5. Honest constraints I will state up front

These go in every report I write. Overpromising here is how the project loses credibility.

| Constraint | Reality | Consequence |
|-----------|---------|-------------|
| **1 GbE fabric** | ~118 MB/s usable per link | Multi-node DDP gradient sync will be **network-bound** for anything bigger than a small CNN. This is a demonstrated limitation, not a failure. |
| **Consumer GPUs (RTX 30/40)** | No NVLink, no GPUDirect RDMA | NCCL falls back to TCP sockets over the NIC. Expect a large gap vs. datacenter numbers. |
| **Unmanaged switch (if that's what we get)** | No VLANs, no LACP, no port stats | N8 segmentation degrades to host-firewall-only. Must be flagged as a risk in N0. |
| **Shared campus LAN** | Other traffic, possible port-security/DHCP policy | Cluster fabric must be a **separate isolated switch**, not a campus VLAN, for the pilot. |
| **Mixed NIC quality** | Realtek onboard NICs drop under sustained load | Per-node NIC qualification is an N1 exit gate, not an assumption. |

The project plan itself already says multi-node distributed training stays outside the
pilot until faster networking (25 GbE) exists. My job is to **measure and prove exactly
where that line is**, so the claim is backed by our own numbers.

---

## 6. What I need from others (and by when)

| I need | From | By phase |
|--------|------|----------|
| Final node count + hardware list | Rahat / Zafor | N0 |
| Physical room, power, switch, cables | Zafor / department | N0–N1 |
| Agreed agent port + protocol | Tanvir | N4 |
| Slurm port set + node naming expectations | Rahat | N4 |
| NFS server address + export list | Shanto | N6 |
| Exporter ports + scrape interval | Zafor | N6 |
| A minimal 2-node DDP script to benchmark with | Sadik Fahim | N7 |

Anything not delivered by its phase becomes a **blocker note** in the phase sign-off,
not a silent delay.

---

## 7. What I deliver to others

See [`interfaces/contracts-with-other-modules.md`](interfaces/contracts-with-other-modules.md)
for the full contract list. Summary:

- `reference/ip-address-plan.md` → everyone hardcoding a host
- `reference/naming-convention.md` → Rahat (Slurm node names), Tanvir (agent identity)
- `reference/port-matrix.md` → Rahat, Tanvir, Shanto, Zafor, Irfanur
- `reference/ssh-standard.md` → Rahat (Slurm/MPI), Sadik Fahim (DDP launcher)
- `reference/nccl-and-mtu-tuning.md` → Sadik Fahim
- N5 + N7 test reports → Ferdowsi (docs), Zafor (monitoring baselines), Rubab (test criteria)
