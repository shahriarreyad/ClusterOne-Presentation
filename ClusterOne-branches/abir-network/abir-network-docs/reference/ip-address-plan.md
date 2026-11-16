# Reference — IP Address Plan

> ⚠️ **This file is a contract.** Other modules depend on it. Changes go through a PR
> and an announcement to the team. Do not edit values ad-hoc on a machine.

**Status:** DRAFT (frozen at N2) · **Owner:** Abir · **Last updated:** _fill in_

---

## 1. Subnets

| Segment | Subnet | VLAN | Gateway | MTU | Notes |
|---------|--------|------|---------|-----|-------|
| `net-cluster` (fabric) | `10.42.0.0/24` | 42 | `10.42.0.10` (anchor NAT) | 9000 | All internal traffic |
| `net-fast` (reserved) | `10.42.1.0/24` | 43 | none | 9000 | Future 10/25 GbE for NCCL |
| `net-oob` (switch mgmt) | `10.42.9.0/29` | 9 | none | 1500 | Anchor access only |
| `net-bmc` (optional) | `10.42.9.8/29` | 9 | none | 1500 | IPMI / out-of-band power |
| Campus uplink | DIU-assigned | — | campus | 1500 | Anchor `eno1` only |

---

## 2. Address blocks within `10.42.0.0/24`

| Range | Purpose | Assignment |
|-------|---------|-----------|
| `.1` | Reserved (switch SVI / gateway placeholder) | Static |
| `.2 – .9` | Reserved for future infrastructure | — |
| **`.10`** | **`anchor01` — controller / head node** | Static |
| `.11 – .19` | Reserved: anchor02 (HA), dedicated storage head, login node | Static |
| **`.21 – .60`** | **Compute nodes `gpu01`–`gpu40`** | Static, `gpuNN = .(20+NN)` |
| `.61 – .99` | Reserved for compute expansion | — |
| `.100 – .149` | Service VIPs / containers, if ever needed | — |
| `.150 – .199` | Reserved | — |
| `.200 – .250` | **DHCP staging pool** (new/unprovisioned nodes) | Dynamic, 12 h lease |
| `.251 – .254` | Test / loaner machines, temporary | Manual |

**The rule that makes this memorable:**

```text
gpuNN  →  10.42.0.(20 + NN)

gpu01 → 10.42.0.21          gpu06 → 10.42.0.26
gpu02 → 10.42.0.22          gpu10 → 10.42.0.30
gpu03 → 10.42.0.23          gpu20 → 10.42.0.40
```

---

## 3. Assigned addresses (the live table)

Update this table whenever a node is added or removed. It is the source for
`hosts.generate.sh`, dnsmasq, `slurm.conf`, and Prometheus targets.

| Hostname | FQDN | IP | Role | MAC | Switch port | Status |
|----------|------|-----|------|-----|-------------|--------|
| `anchor01` | `anchor01.clusterone.internal` | `10.42.0.10` | Controller | _tbd_ | SW01-P01 | planned |
| `anchor01-oob` | `anchor01-oob.clusterone.internal` | `10.42.9.2` | Switch mgmt leg (VLAN 9, `OOB=1`) | _n/a_ | SW01-P01 (tagged) | optional, managed switch only |
| `gpu01` | `gpu01.clusterone.internal` | `10.42.0.21` | Compute | _tbd_ | SW01-P02 | planned |
| `gpu02` | `gpu02.clusterone.internal` | `10.42.0.22` | Compute | _tbd_ | SW01-P03 | planned |
| `gpu03` | `gpu03.clusterone.internal` | `10.42.0.23` | Compute | _tbd_ | SW01-P04 | planned |
| `gpu04` | `gpu04.clusterone.internal` | `10.42.0.24` | Compute | _tbd_ | SW01-P05 | planned |
| `gpu05` | `gpu05.clusterone.internal` | `10.42.0.25` | Compute | _tbd_ | SW01-P06 | planned |
| `sw01` | `sw01.clusterone.internal` | `10.42.9.1` | Switch mgmt | _tbd_ | — | planned |

Status values: `planned` → `cabled` → `configured` → `production` → `retired`.

---

## 4. Machine-readable source

`infrastructure/networking/inventory/nodes.csv` — the file every generator reads:

```csv
# shortname,ip,role
anchor01,10.42.0.10,controller
gpu01,10.42.0.21,compute
gpu02,10.42.0.22,compute
gpu03,10.42.0.23,compute
gpu04,10.42.0.24,compute
gpu05,10.42.0.25,compute
```

Consumers: `hosts.generate.sh`, the dnsmasq config generator, Ansible inventory,
`iperf-matrix.sh`, `port-check.sh`, and Prometheus target files.

Keep this table and that CSV in sync in the **same commit**, always.

---

## 5. Rules

1. **Never hardcode an IP in application code.** Use hostnames. If a module needs an
   address, it resolves the name.
2. **Never assign an address by hand on a machine.** It goes in the table → the CSV →
   the netplan file → Ansible.
3. **Never reuse a retired node's address for 30 days.** Stale ARP entries and cached
   configs cause confusing failures.
4. **The staging pool is not a home.** Nothing runs in production on `.200+`.
5. **Adding a node** = follow [RB-01](../runbooks/RB-01-add-new-node.md), which starts by
   editing this file.

---

## 6. Change log

| Date | Change | By | PR |
|------|--------|-----|-----|
| _tbd_ | Initial plan (N2 freeze) | Abir | — |
