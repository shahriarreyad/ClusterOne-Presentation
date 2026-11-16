# Interfaces — Contracts With Other Modules

What I owe each teammate, what I need from them, and how to tell whose bug it is.

Keep this open during standups — most cross-module confusion on a cluster project is a
network-boundary question, and this table answers it in one line.

---

## Quick triage: is it a network problem?

```text
   Can't reach a host at all?              → Abir (RB-02)
   Reachable but a port is refused?        → Abir (port matrix)
   Name doesn't resolve?                   → Abir (RB-02 §C)
   SSH asks for a password?                → Abir (ssh-standard §6)
   Slower than the N5 baseline?            → Abir (RB-03)
   ─────────────────────────────────────────────────────────
   Service is down / crashed?              → that service's owner
   Returns an error or wrong data?         → that service's owner
   Job queued too long?                    → Rahat (scheduler)
   GPU idle while the network is idle?     → the training code
```

---

## 1. Rahat — Core Engine, Scheduler, Slurm

**I give:**
- Hostnames that match `hostname -s` exactly, so `slurm.conf` node names work
- Ports 6817 (G→A), 6818 (A→G), 6819 (local), 60001–63000 (steps) open and verified
- Passwordless SSH from `anchor01` to every node
- Time sync via chrony — Slurm rejects nodes with skewed clocks
- A `netcheck.sh` result he can attach to a bug report

**I need:**
- Confirmed `SrunPortRange` matching my firewall rule
- The exact node-name expression used in `slurm.conf`
- Notice before any new service needs a port

**Boundary:** node `DOWN` in `sinfo` → I check reachability + ports; if those pass, it's
`slurmd` or the munge key, and it's his.

---

## 2. Tanvir — Node Agent

**I give:**
- A guaranteed transport between `anchor01` and every node
- The agent's port open in both directions once he confirms it
- Stable hostnames, so agent identity doesn't churn
- DNS so the agent can find the controller by name, not IP

**I need:**
- The port and protocol (HTTP? gRPC? push or pull?) — needed by **N4**
- Whether the agent initiates to the anchor or the anchor polls it (this determines the
  firewall direction and it is not a detail)
- Heartbeat interval and timeout, so I can size the alert thresholds

**Boundary:** heartbeat missing → I check `ping` + the port; if both pass, the agent
process is his.

**⚠️ Standing request:** the agent must connect to `anchor01` **by name**, never by IP.

---

## 3. Md Shanto Ali — Storage

**I give:**
- NFS ports open (2049, 111, 20048) and verified from every node
- MTU 9000 verified end to end — worth roughly 2× on large sequential reads
- Measured NFS throughput and the concurrency ceiling (N6)
- Recommended mount options with the measurements that justify them

**I need:**
- The storage host address and the export list
- `mountd` **pinned** to a fixed port in `/etc/nfs.conf` — a random port cannot be
  firewalled
- NFS version (v4 strongly preferred: one port instead of five)

**Boundary:** mount hangs → I verify port + MTU + link; if those pass, it's the export
config or the server, and it's his.

**⚠️ Standing request:** `hard` mounts, never `soft`. A soft mount turns a 2-second
network blip into a corrupted checkpoint.

---

## 4. Zafor — Monitoring (and PR review)

**I give:**
- Exporter ports open from the anchor only
- The network metric list and alert thresholds (N6.3)
- Baseline numbers so his thresholds mean something
- A network Grafana panel spec

**I need:**
- Exporter ports and scrape interval
- Confirmation that alerts actually fire when I cause the condition
- PR review on every phase, and the phase sign-off

**Boundary:** target down → I check reachability + port; if both pass, it's the exporter.

---

## 5. Sadik Fahim — Distributed AI

**The most technical interface I own.**

**I give:**
- Passwordless **node→node** SSH (`torchrun` and MPI both require it)
- Rendezvous ports 29400–29600 and the NCCL ephemeral range open between nodes
- MTU 9000 verified between every pair
- `NCCL_SOCKET_IFNAME` set cluster-wide in `/etc/profile.d/`
- TCP stack tuned for bulk transfer
- **The measured all-reduce ceiling** and the honest scaling curve (N7)
- Three concrete, measured mitigations: gradient accumulation, larger batch, bf16 grads

**I need:**
- A minimal 2-node DDP script for benchmarking
- Exclusive access to 2–4 GPU nodes for a few hours during N7
- His measured step times so I can separate compute time from communication time

**Boundary:** job hangs at `init_process_group` → I verify SSH, ports, MTU and interface
selection; if those pass, it's the launcher or the script.

**⚠️ Standing note:** on 1 GbE, multi-node DDP is communication-bound for most real
models. That is expected. See `reference/nccl-and-mtu-tuning.md` §8 for what the fabric
can actually deliver, and §2 for what to do about it.

---

## 6. Sourav Kundu — Database (+ distributed job data)

**I give:**
- Whatever port he needs, restricted to the anchor (Postgres stays localhost-only)
- Per-node network metrics if he wants to store them alongside job records

**I need:**
- Nothing blocking. If distributed job records should carry which fabric a run used,
  tell me and I'll define the field.

**Boundary:** DB unreachable → I verify the port; if it's open, it's Postgres.

---

## 7. Tanjimul — Containers

**I give:**
- Host-network containers inherit the host firewall — no extra config needed
- Guidance on which network mode is allowed and why

**I need:**
- Confirmation that Apptainer containers use the host network (they do by default)
- A heads-up if Docker is ever installed on a compute node — **it rewrites iptables and
  can silently open ports through my firewall**

**Boundary:** no network inside a container → I check the host first; if the host is fine,
it's the container's network mode.

---

## 8. MD Irfanur Islam — Authentication

**I give:**
- A route from the anchor to the campus IdP for OIDC
- 443 open from campus to the anchor, and nothing else
- SSH access control at the network layer (`AllowGroups`, source restrictions)

**I need:**
- Which external endpoints auth must reach, so the N8 egress allowlist doesn't break login
- The group names to use in `AllowGroups`

---

## 9. Anushka / Sourav Ghosh / Sadik — Frontend

**I give:**
- The dashboard reachable at 443 from campus
- The backend reachable from the frontend

**I need:**
- Nothing blocking.

**⚠️ Standing request:** no hardcoded IPs in frontend or backend config. Use hostnames.
I audit for this in N9 and will open PRs against anything I find.

---

## 10. Rubab — Testing

**I give:**
- `netcheck.sh`, `port-check.sh`, `iperf-matrix.sh` — all usable as CI gates
- Pass/fail thresholds for every network property
- The failure scenarios worth testing: cable pull, node down, switch down, saturation

**I need:**
- Network checks included in the integration test suite
- A ping when a test failure looks network-shaped, before it's filed against another module

---

## 11. Ferdowsi Yarin — Documentation

**I give:**
- The topology diagram, the plain-English network overview, the glossary
- The N5 and N7 findings in a form suitable for the research write-up

**I need:**
- A review pass for readability — if a non-networking teammate can't follow my docs,
  the docs are wrong, not the reader.

---

## Standing requests to the whole team

1. **Never hardcode an IP.** Use hostnames. I audit in N9.
2. **Never open a firewall port yourself.** PR against `reference/port-matrix.md`.
3. **Before filing a network bug**, run `netcheck.sh` and attach the output.
4. **Tell me before you add a service** that needs a port — one day's notice saves an
   afternoon of debugging.
5. **"It's slow" is not a bug report.** Run `iperf3` and compare against the N5 baseline;
   RB-03 walks you through it in five minutes.
