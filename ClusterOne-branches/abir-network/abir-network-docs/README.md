# 🌐 ClusterOne — Networking Module

**Owner:** Abir (CSE Tech)
**Branch:** `abir/network`
**Code folder:** `infrastructure/networking/`
**Docs folder:** `abir-network-docs/` (this folder — planning + runbooks)

---

## What this folder is

The complete engineering plan for the **networking module** of ClusterOne — the layer
that turns a pile of separate PCs into machines that can actually find, trust, and talk
to each other fast enough to run distributed AI training.

Nothing else in ClusterOne works until this does. The node agent can't send a heartbeat,
Slurm can't dispatch a job, NFS can't mount, Prometheus can't scrape, and PyTorch DDP
can't do an all-reduce — all of it rides on this module.

> **My one-line job:** *Every node can reach every other node, by name, over a known
> route, on a known port, at a measured speed, and I can prove it with a test report.*

---

## How to read this folder

Read in this order the first time:

| Order | File | Why |
|-------|------|-----|
| 1 | [`00-role-charter.md`](00-role-charter.md) | Exactly what is mine vs. someone else's |
| 2 | [`01-network-architecture.md`](01-network-architecture.md) | The design I am building toward |
| 3 | [`02-phase-plan.md`](02-phase-plan.md) | **The master roadmap — N0 → N9** |
| 4 | [`phases/`](phases/) | One deep file per phase: tasks, configs, tests, exit gate |
| 5 | [`reference/`](reference/) | Frozen decisions: IPs, names, ports, SSH, tuning |
| 6 | [`runbooks/`](runbooks/) | What to do at 2am when something breaks |
| 7 | [`templates/`](templates/) | Forms to fill for intake, sign-off, test reports |
| 8 | [`interfaces/`](interfaces/) | The contracts I owe other teammates |

---

## Folder map

```text
abir-network-docs/
├── README.md                         ← you are here
├── 00-role-charter.md                scope, non-scope, definition of done
├── 01-network-architecture.md        topology, segments, design decisions
├── 02-phase-plan.md                  master roadmap N0–N9 + 12-week schedule
│
├── phases/
│   ├── done-N0-requirements-and-site-survey.md
│   ├── done-N1-physical-layer-build.md
│   ├── done-N2-addressing-hostnames-dns.md
│   ├── done-N3-ssh-and-access-layer.md
│   ├── done-N4-service-connectivity-and-firewall.md
│   ├── done-N5-performance-baseline.md
│   ├── done-N6-storage-and-monitoring-paths.md
│   ├── done-N7-distributed-ai-fabric.md
│   ├── done-N8-hardening-and-segmentation.md
│   └── done-N9-handover-and-production.md
│
├── reference/
│   ├── ip-address-plan.md            THE authoritative IP table
│   ├── naming-convention.md          hostnames, FQDNs, interface aliases
│   ├── port-matrix.md                every port every service needs
│   ├── ssh-standard.md               key policy, sshd config, host-based auth
│   ├── nccl-and-mtu-tuning.md        jumbo frames, NCCL env vars, bonding
│   └── glossary.md                   plain-English terms for the team
│
├── runbooks/
│   ├── RB-01-add-new-node.md
│   ├── RB-02-node-unreachable.md
│   ├── RB-03-slow-network-triage.md
│   └── RB-04-switch-or-link-failure.md
│
├── templates/
│   ├── node-intake-form.md
│   ├── phase-exit-signoff.md
│   └── network-test-report.md
│
├── scripts/
│   ├── netcheck.sh                   one-shot health check for a node
│   ├── iperf-matrix.sh               full N×N bandwidth matrix
│   └── port-check.sh                 verify the port matrix is actually open
│
└── interfaces/
    └── contracts-with-other-modules.md
```

---

## The phases at a glance

```text
N0  Requirements & Site Survey        → I know what hardware exists
N1  Physical Layer Build              → cables in, every link up at full speed
N2  Addressing, Hostnames, DNS        → every node has a fixed IP + resolvable name
N3  SSH & Access Layer                → passwordless, key-only, node↔node trust
─────────── MILESTONE 1: "3 PCs are connected and reachable" ───────────
N4  Service Connectivity & Firewall   → Slurm/agent/NFS/Prometheus ports proven open
N5  Performance Baseline              → measured bandwidth + latency matrix, published
N6  Storage & Monitoring Paths        → NFS and scrape traffic tuned and isolated
─────────── MILESTONE 2: "the cluster runs independent jobs" ───────────
N7  Distributed AI Fabric             → jumbo frames, NCCL tuning, all-reduce benchmark
N8  Hardening & Segmentation          → VLANs, firewall policy, no flat trust
N9  Handover & Production             → runbooks, monitoring, docs, sign-off
─────────── MILESTONE 3: "v1.0 network, documented and defensible" ─────
```

Full detail, exit gates and week-by-week schedule: [`02-phase-plan.md`](02-phase-plan.md).

---

## My first milestone (the only thing that matters in week 1–3)

The team's first milestone is:

> *"Three PCs are connected, the controller can detect them, each node reports
> CPU/RAM/GPU info, and the controller can submit a simple job to a selected node."*

My slice of that is **N0 → N3**:

- [ ] Controller (`anchor01`) and 3 compute nodes (`gpu01`–`gpu03`) on one switch
- [ ] Static IPs from `10.42.0.0/24`, no DHCP surprises
- [ ] `ping gpu01` works from anywhere in the cluster — **by name, not IP**
- [ ] `ssh gpu01` from `anchor01` works with **no password prompt**
- [ ] `ssh gpu02` from `gpu01` works (node↔node — DDP needs this later)
- [ ] `iperf3` between any two nodes ≥ 900 Mbit/s on 1 GbE
- [ ] A one-page test report committed to `infrastructure/networking/reports/`

When those six boxes are ticked, Tanvir's agent and Rahat's backend are unblocked.

---

## Working agreement

- I work only on `abir/network`. PRs go to `develop`, reviewed by **Zafor**.
- Code and configs live in `infrastructure/networking/`. Planning lives here.
- Any change to IPs, hostnames or ports is a **PR against `reference/`**, announced to
  the team — those files are contracts other people build against.
- Every phase ends with a filled-in [`phase-exit-signoff.md`](templates/phase-exit-signoff.md).
  No sign-off, no next phase.

---

## Commit convention for this module

```text
feat(net): add nftables ruleset for compute nodes
fix(net): correct MTU 9000 on gpu03 bond0
docs(net): publish N5 bandwidth matrix report
chore(net): add iperf-matrix.sh helper
test(net): add NCCL all-reduce baseline results
```
