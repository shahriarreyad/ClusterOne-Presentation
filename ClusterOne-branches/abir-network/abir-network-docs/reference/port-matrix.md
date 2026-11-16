# Reference — Port Matrix

> ⚠️ **Contract file.** This is the firewall allowlist. If a service isn't here, it is
> blocked. Adding a row = a PR + a note to Zafor.

**Status:** DRAFT (frozen at N4) · **Owner:** Abir · **Last updated:** _fill in_

Legend: `A` = anchor01 · `G` = any compute node (`gpuNN`) · `C` = campus/user network

---

## 1. Core cluster services

| Service | Port | Proto | Direction | Owner | Notes |
|---------|------|-------|-----------|-------|-------|
| SSH | 22 | TCP | G⇄G, A⇄G, C→A | Abir | Key-only. C→G is **blocked**. |
| DNS (dnsmasq) | 53 | TCP+UDP | G→A | Abir | Fabric resolution |
| DHCP (staging) | 67, 68 | UDP | G→A | Abir | Only for unprovisioned nodes |
| NTP (chrony) | 123 | UDP | G→A | Abir | Clock sync — Slurm depends on it |
| syslog (central) | 514 | TCP | G→A | Abir | Audit forwarding (N8) |
| ICMP | — | ICMP | fabric-wide | Abir | **Never block.** Primary diagnostic. |

## 2. Slurm

| Service | Port | Proto | Direction | Owner | Notes |
|---------|------|-------|-----------|-------|-------|
| slurmctld | 6817 | TCP | G→A | Rahat | Nodes report to the controller |
| slurmd | 6818 | TCP | A→G | Rahat | Controller dispatches to nodes |
| slurmdbd | 6819 | TCP | A→A | Rahat | Accounting DB, local only |
| srun / step ports | 60001–63000 | TCP | A⇄G, G⇄G | Rahat | Set `SrunPortRange` in `slurm.conf` to match |
| munge | — | — | — | Rahat | Unix socket, no TCP port. Shared key must be identical on all nodes. |

> 6817 and 6818 go in **opposite directions**. Allowing only one is the single most
> common reason Slurm nodes sit in `DOWN`.

## 3. ClusterOne application

| Service | Port | Proto | Direction | Owner | Notes |
|---------|------|-------|-----------|-------|-------|
| Node agent | 9500 | TCP | A⇄G | Tanvir | ⚠️ **confirm** — placeholder until Tanvir fixes it |
| iperf3 (benchmark only) | 5201 | TCP | G⇄G, A⇄G | Abir | **Closed by default.** Opened temporarily by `scripts/bench-fw.sh` for N1/N5/N7 measurements |
| Backend API | 8000 | TCP | G→A, C→A (via 443) | Rahat | Internal HTTP |
| Web / dashboard | 443 | TCP | C→A | Rahat/Sadik | TLS terminated at the anchor |
| HTTP redirect | 80 | TCP | C→A | Rahat/Sadik | Redirect to 443 only |
| PostgreSQL | 5432 | TCP | A→A | Kundu | **Localhost only.** Never exposed to the fabric. |

## 4. Storage

| Service | Port | Proto | Direction | Owner | Notes |
|---------|------|-------|-----------|-------|-------|
| NFSv4 | 2049 | TCP | G→A | Shanto | NFSv4 needs only this port — prefer it |
| rpcbind | 111 | TCP+UDP | G→A | Shanto | NFSv3 only |
| mountd | 20048 | TCP+UDP | G→A | Shanto | **Must be pinned** in `/etc/nfs.conf` |
| statd / lockd | 32765–32768 | TCP+UDP | G→A | Shanto | NFSv3 only; pin them too |

## 5. Monitoring

| Service | Port | Proto | Direction | Owner | Notes |
|---------|------|-------|-----------|-------|-------|
| node_exporter | 9100 | TCP | A→G | Zafor | Anchor scrapes only — not node→node |
| dcgm-exporter | 9400 | TCP | A→G | Zafor | GPU metrics |
| blackbox_exporter | 9115 | TCP | A→G | Zafor | ICMP latency probes (recommended in N6.3) |
| Prometheus | 9090 | TCP | A→A | Zafor | Localhost/anchor only |
| Grafana | 3000 | TCP | C→A | Zafor | Or behind the 443 reverse proxy |
| Alertmanager | 9093 | TCP | A→A | Zafor | Localhost only |

## 6. Distributed training

| Service | Port | Proto | Direction | Owner | Notes |
|---------|------|-------|-----------|-------|-------|
| torchrun / c10d rendezvous | 29400–29600 | TCP | G⇄G | Fahim | `MASTER_PORT` default 29500 |
| NCCL data sockets | 32768–60999 | TCP | G⇄G | Fahim | Kernel ephemeral range; NCCL picks from it |
| MPI (if used) | 1024–65535 | TCP | G⇄G | Fahim | Constrain with `--mca btl_tcp_port_min_v4` if OpenMPI is used |

> The ephemeral range is wide by necessity. It's acceptable because it's restricted to
> **fabric source addresses only** — a compute node still cannot be reached from campus.

## 7. Management

| Service | Port | Proto | Direction | Owner | Notes |
|---------|------|-------|-----------|-------|-------|
| Switch web/CLI | 80, 443, 22 | TCP | A→sw01 | Abir | **Anchor only**, never from a compute node |
| IPMI / BMC | 623 | UDP | A→BMC | Abir | If hardware supports it |

---

## 8. Explicitly blocked

Stating these makes the negative tests in N4.6 concrete:

| What | Why |
|------|-----|
| C→G, anything | Compute nodes are never directly reachable from campus |
| G→sw01 management | A compromised job must not reconfigure the switch |
| G→A:9090, 9093, 5432 | Nodes have no business reaching Prometheus, Alertmanager or the DB |
| G→G:9100 | Exporters answer the anchor only |
| Any UDP not listed | Default deny includes UDP |
| IPv6 (pilot) | Not configured; disable it rather than leave it unfiltered |

---

## 9. Requesting a change

1. Open a PR editing this file: service, port, protocol, direction, owner, justification
2. Tag Abir + Zafor
3. On merge, Abir updates the nftables rulesets and re-runs `port-check.sh`
4. The requester verifies from their own module and confirms on the PR

**Never** open a port directly on a node with `nft` and move on. It will disappear on the
next reboot or the next Ansible run, and the failure will land on someone else.

---

## 10. Open items

| Item | Owner | Needed by |
|------|-------|-----------|
| Confirm the node agent's port and protocol | Tanvir | N4 |
| Confirm `SrunPortRange` matches 60001–63000 | Rahat | N4 |
| Confirm NFS version (v4 preferred — far fewer ports) | Shanto | N6 |
| Confirm `MASTER_PORT` for torchrun | Fahim | N7 |
