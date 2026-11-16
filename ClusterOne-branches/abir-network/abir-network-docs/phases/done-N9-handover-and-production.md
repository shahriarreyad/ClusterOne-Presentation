# Phase N9 — Handover & Production

> **Goal:** Make the network something the *team* owns, not something only I understand.
> Then close the module out for v1.0.

| | |
|---|---|
| **Duration** | 3–4 days (week 11–12) |
| **Entry condition** | N8 signed off |
| **Blocks** | 🏁 **Milestone 3** — the v1.0 release |
| **Blocked by** | A teammate's time to dry-run the runbooks |

---

## Why this phase exists

Risk **R8** in the register: *"I am the only one who knows the network."* On a 14-person
student project, people graduate, get busy, or take other courses. A network only I can
operate is a liability disguised as a contribution.

This phase converts everything I've built into artifacts other people can use without me.

---

## Tasks

### N9.1 — Finalise all runbooks

Each runbook must be usable by someone who has never touched the cluster:

| Runbook | Scenario | Must answer |
|---------|----------|-------------|
| [RB-01](../runbooks/RB-01-add-new-node.md) | A new PC joins ClusterOne | Exact steps, in order, with the verification at each step |
| [RB-02](../runbooks/RB-02-node-unreachable.md) | A node stops responding | Decision tree from "ping fails" to root cause |
| [RB-03](../runbooks/RB-03-slow-network-triage.md) | "The cluster feels slow" | How to compare against the N5 baseline and find the culprit |
| [RB-04](../runbooks/RB-04-switch-or-link-failure.md) | Switch or a link dies | Failover, spare-switch swap, what to tell users |

**The dry-run is the point.** Hand RB-01 to Tanvir or Rubab and have them add a node with
me watching but not helping. Every place they hesitate is a gap in the runbook — fix it
on the spot. A runbook that has never been executed by someone else is a draft.

### N9.2 — Configuration as code, verified

Every network setting must exist in git, and the cluster must be reproducible from it:

- [ ] `netplan/` — one file per node
- [ ] `dns/` — dnsmasq config + hosts generator
- [ ] `ssh/` — sshd_config, public keys, known_hosts generator
- [ ] `firewall/` — anchor.nft, compute.nft, POLICY.md
- [ ] `sysctl/` — tuning from N7
- [ ] `switch/` — config backup + a README on how to restore it
- [ ] `ansible/` — playbooks that apply all of the above

**Reproducibility test:** wipe one compute node, reinstall the OS, run the playbook, and
confirm it rejoins the cluster with **no manual steps**. If that works, the network is
genuinely code. If it needs "oh and also do X by hand," X is a missing playbook task.

### N9.3 — Hand monitoring and alerting to Zafor

- [ ] Alert rules from N6.3 merged into Zafor's Prometheus config and firing correctly
- [ ] A **network panel** in Grafana: per-node link status, throughput, errors, RTT
- [ ] Test each alert by causing the condition (pull a cable, saturate a link) — an
      alert that has never fired is an untested alert
- [ ] Document what each alert means and which runbook it points to

### N9.4 — Audit the rest of the codebase for hardcoded IPs

Risk R7. Make it concrete:

```bash
grep -rnE '10\.42\.0\.[0-9]+' --include='*.py' --include='*.js' --include='*.ts' \
  --include='*.yaml' --include='*.yml' --include='*.conf' . \
  | grep -v 'infrastructure/networking'
```

Every hit outside `infrastructure/networking/` is a bug. Open a PR (or an issue with the
exact line) for whoever owns that module, and explain the replacement: use the hostname.

### N9.5 — Documentation handover to Ferdowsi

Give Ferdowsi, in a form he can fold into `docs/`:

- The topology diagram (from `01-network-architecture.md`)
- A plain-English "how ClusterOne's network works" page for non-networking readers
- The user-facing bits: how to SSH in, why nodes have no direct internet, how to request
  a port opened
- The research-relevant findings: N5 baseline, N7 scaling results, the 25 GbE recommendation

### N9.6 — Final acceptance test

One end-to-end run, from a cold start:

1. Power the entire cluster off, then on.
2. Wait for boot; run nothing manually.
3. `scripts/netcheck.sh` on every node → all green
4. `scripts/port-check.sh` → 100% pass
5. `scripts/iperf-matrix.sh` → within 5% of the N5 baseline
6. Submit a Slurm job → it runs
7. Submit a 2-node distributed job → it runs
8. All Prometheus targets `up`

Record the whole thing in `reports/N9-acceptance.md`. This is the evidence for the
release review.

### N9.7 — Close out the module

- [ ] Final PR: `abir/network` → `develop`, reviewed and merged by Zafor
- [ ] All ten phase sign-off sheets filled and committed
- [ ] Risk register updated: which risks materialised, how they were handled, what's still open
- [ ] A short "future work" section: 25 GbE upgrade, HTTP egress proxy, host-based SSH
      auth, redundant switch, IPv6
- [ ] A 5–10 minute walkthrough of the network for the whole team, recorded if possible

---

## Deliverables

- [ ] 4 runbooks, each dry-run by someone other than me
- [ ] Complete infrastructure-as-code tree + a passing reproducibility test
- [ ] Grafana network panel + tested alerts, owned by Zafor
- [ ] Hardcoded-IP audit results, with PRs/issues raised
- [ ] Docs package handed to Ferdowsi
- [ ] `reports/N9-acceptance.md`
- [ ] Final merged PR

---

## Exit gate 🏁 (**Milestone 3**)

> **The cold-start acceptance test passes end to end with zero manual intervention;
> all four runbooks have been executed successfully by someone who did not write them;
> the final PR is merged into `develop`.**

---

## What "done" does not mean

Done means the pilot network is complete, documented, and defensible. It does **not** mean:

- the fabric is fast enough for serious multi-node training (N7 documents exactly why not)
- there is no single point of failure (the switch still is one — documented, not solved)
- security is finished (network-layer hardening is done; application security is Irfanur's
  and Zafor's continuing work)

Saying this plainly at handover is more useful than claiming a finished system. It tells
the next person exactly where to start.
