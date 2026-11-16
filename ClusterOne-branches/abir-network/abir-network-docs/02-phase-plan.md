# 02 — Master Phase Plan (N0 → N9)

The roadmap for the networking module. Ten phases, each with an **entry condition**, a
**deliverable set**, and a **hard exit gate**. A phase is not "done" because time passed —
it is done when its exit gate is demonstrated and signed off.

Deep detail for each phase lives in [`phases/`](phases/).

---

## 1. Phase ladder

```text
   N0 ── Requirements & Site Survey
   │      "I know exactly what hardware exists and what it can do."
   ↓
   N1 ── Physical Layer Build
   │      "Every link is up, at full speed, on a labelled cable."
   ↓
   N2 ── Addressing, Hostnames, DNS
   │      "Every node has a fixed IP and answers to its name."
   ↓
   N3 ── SSH & Access Layer
   │      "Passwordless, key-only, in every direction the cluster needs."
   │
   ╠══════════ 🏁 MILESTONE 1 — nodes are reachable ══════════
   │           unblocks: Tanvir (agent), Rahat (backend)
   ↓
   N4 ── Service Connectivity & Firewall
   │      "Every port in the matrix is open where it must be, closed elsewhere."
   ↓
   N5 ── Performance Baseline
   │      "Published bandwidth + latency matrix. Numbers, not opinions."
   ↓
   N6 ── Storage & Monitoring Paths
   │      "NFS and Prometheus traffic flow cleanly and are measured."
   │
   ╠══════════ 🏁 MILESTONE 2 — cluster runs independent jobs ══════════
   │           unblocks: Shanto (storage), Zafor (monitoring), Rahat (Slurm)
   ↓
   N7 ── Distributed AI Fabric
   │      "Jumbo frames verified, NCCL tuned, all-reduce benchmarked honestly."
   ↓
   N8 ── Hardening & Segmentation
   │      "VLANs, egress allowlist, no flat trust, audit-ready."
   ↓
   N9 ── Handover & Production
          "Runbooks, alerts, docs, sign-off. Someone else can run it."

   ╠══════════ 🏁 MILESTONE 3 — v1.0 network ══════════
```

---

## 2. Phase summary table

| Phase | Name | Exit gate (the one thing that must be demonstrated) | Est. |
|-------|------|------------------------------------------------------|------|
| **N0** | Requirements & Site Survey | A completed node inventory + a signed hardware/risk report | 3–5 d |
| **N1** | Physical Layer Build | `ethtool` shows 1000 Mb/s full-duplex on **every** node; zero errors after a 10-min saturation soak | 3–5 d |
| **N2** | Addressing, Hostnames, DNS | `ping -c1 gpuNN` succeeds by short name from every node, after a reboot | 3–4 d |
| **N3** | SSH & Access Layer | `pdsh -a hostname` (or a for-loop) returns all nodes with zero prompts; password auth disabled | 3–4 d |
| **N4** | Service Connectivity & Firewall | `scripts/port-check.sh` passes 100% of the port matrix, and denies everything not in it | 4–6 d |
| **N5** | Performance Baseline | A committed N×N bandwidth + latency matrix meeting the stated thresholds | 3–4 d |
| **N6** | Storage & Monitoring Paths | Sustained NFS read ≥ 100 MB/s; Prometheus scrapes all nodes with 0 failures for 24 h | 3–5 d |
| **N7** | Distributed AI Fabric | 2-node `all_reduce_perf` completes; bus bandwidth recorded; DDP scaling report published | 5–8 d |
| **N8** | Hardening & Segmentation | External scan shows only intended ports; egress allowlist enforced; audit log flowing | 4–6 d |
| **N9** | Handover & Production | All 4 runbooks dry-run by a non-author; final PR merged to `develop` | 3–4 d |

---

## 3. 12-week schedule (aligned to the pilot timeline)

```text
Week  1   2   3   4   5   6   7   8   9  10  11  12
      ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
N0    ███
N1    ░███
N2        ███
N3        ░███
                🏁 M1 (end of week 4)
N4            ░████
N5                ███
N6                ░████
                            🏁 M2 (end of week 8)
N7                      ░███████
N8                              ░█████
N9                                    ░████
                                          🏁 M3 (end of week 12)
```

Overlap is deliberate: N1 cabling can proceed while N0's hardware report is still being
written, N5 measurement runs while N6 storage paths are still being tuned. What must
**not** overlap is a phase starting before its predecessor's exit gate is signed.

---

## 4. Dependency graph

```text
                 N0 (survey)
                     │
                     ↓
                 N1 (physical) ──── needs: switch, cables, room, power
                     │
                     ↓
                 N2 (IP + DNS) ──── delivers: ip-address-plan.md → EVERYONE
                     │
                     ↓
                 N3 (SSH) ───────── delivers: passwordless trust → Rahat, Fahim
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
     N4 (ports)  N5 (perf)   [Tanvir: agent]  [Rahat: Slurm]
        │            │
        └─────┬──────┘
              ↓
          N6 (storage + monitoring paths) ── needs: Shanto NFS, Zafor exporters
              │
              ↓
          N7 (distributed fabric) ────────── needs: Fahim's 2-node DDP script
              │
              ↓
          N8 (hardening)
              │
              ↓
          N9 (handover)
```

**Hard blockers I create if I'm late:**
- N2 late → Tanvir cannot register nodes, Rahat cannot address them.
- N3 late → Slurm cannot launch, MPI/DDP cannot start.
- N4 late → nothing talks to anything; the whole Step-3 chain stalls.

**Hard blockers others create for me:**
- No switch/room → N1 stops dead. Escalate to Zafor on day 1 of N0, not week 3.
- No agreed agent port → N4 ships with a placeholder and needs a second PR.
- No DDP test script → N7 falls back to synthetic `nccl-tests` only.

---

## 5. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Trigger to escalate |
|----|------|-----------|--------|-----------|--------------------|
| R1 | Only an unmanaged switch is available | High | Medium | Fall back to host-firewall-only segmentation; document the gap in N8 | End of N0 |
| R2 | Onboard Realtek NICs drop packets under sustained load | Medium | High | Per-node NIC qualification soak in N1; budget for 2–3 Intel PCIe NICs | Any node fails the N1 soak |
| R3 | 1 GbE makes multi-node DDP slower than single-node | **High** | Medium | Expected and planned for. Publish the honest scaling curve in N7; recommend 10/25 GbE with our own numbers as evidence | N7 measurement |
| R4 | Campus IT blocks a private switch or the uplink | Medium | High | Get written approval during N0; keep the fabric fully private so campus sees one MAC | End of N0 |
| R5 | Nodes get re-imaged and lose their network config | Medium | Medium | All config lives in Ansible/`netplan` files in git, never typed by hand | Any manual reconfiguration |
| R6 | MTU 9000 breaks a service that assumes 1500 | Medium | Medium | Verify path MTU per pair in N7 before enabling globally; keep 1500 on the campus interface | Any unexplained hang on large transfers |
| R7 | Team members hardcode IPs despite the naming rule | High | Medium | Grep the repo in N9; raise PRs against offenders | Found in any module's code |
| R8 | I am the only one who knows the network | Medium | **High** | Runbooks + a second person dry-runs each one in N9 | N9 |

---

## 6. Deliverable index

Everything I hand over, and where it goes:

| Deliverable | Phase | Location |
|-------------|-------|----------|
| Node inventory + hardware report | N0 | `infrastructure/networking/inventory/` |
| Physical topology + cable map | N1 | `abir-network-docs/01-network-architecture.md` + a photo in `docs/` |
| `netplan` / config templates | N2 | `infrastructure/networking/netplan/` |
| `hosts.generate.sh`, dnsmasq config | N2 | `infrastructure/networking/dns/` |
| `sshd_config` baseline + key rollout playbook | N3 | `infrastructure/networking/ssh/` |
| `nftables` rulesets (anchor + compute) | N4 | `infrastructure/networking/firewall/` |
| `port-check.sh`, `netcheck.sh`, `iperf-matrix.sh` | N4–N5 | `infrastructure/networking/scripts/` |
| Bandwidth + latency matrix report | N5 | `infrastructure/networking/reports/N5-baseline.md` |
| NFS + scrape path tuning notes | N6 | `infrastructure/networking/reports/N6-paths.md` |
| NCCL tuning guide + all-reduce results | N7 | `reference/nccl-and-mtu-tuning.md` + `reports/N7-nccl.md` |
| Segmentation + firewall policy doc | N8 | `infrastructure/networking/firewall/POLICY.md` |
| 4 runbooks | N1–N9 | `abir-network-docs/runbooks/` |
| Network alert definitions | N9 | handed to Zafor for Prometheus |

---

## 7. How I run each phase (the loop)

```text
1. Read the phase file in phases/
2. git checkout develop && git pull && git checkout abir/network && git rebase develop
3. Do the work; commit in small pieces with feat(net)/fix(net)/docs(net)
4. Run the phase's verification commands; save raw output
5. Fill templates/network-test-report.md with the real numbers
6. Fill templates/phase-exit-signoff.md
7. Push and open a PR → develop, tag Zafor
8. Announce to the team what changed in reference/ (if anything)
9. Only then start the next phase
```

**Rule I hold myself to:** no phase exits on "it looked fine." It exits on a command
whose output I can paste into a report.
