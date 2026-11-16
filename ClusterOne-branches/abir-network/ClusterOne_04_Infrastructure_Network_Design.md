# ClusterOne — Infrastructure & Network Design



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | Infrastructure & Network Design |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Target Environment | DIU Campus — pilot deployment, single building |
| Status | Draft — Pilot / Phase 1 |
| Dependencies | DIU netops (VLAN and switch ports), DIU IT (DNS), Facilities (power, cooling) |

# 1. Purpose and Scope

This document specifies the physical and network infrastructure required to operate ClusterOne: servers, storage, network segmentation, addressing, power, cooling, and the environmental measurements that gate deployment. It covers the pilot only — one anchor node and four to six GPU compute nodes in a single building.

Growth beyond this footprint is addressed in §9.

# 2. Site and Physical Layout

## 2.1 Sites

| Site | Role | Notes |
| --- | --- | --- |
| Anchor rack | Hosts anchor node, UPS, managed switch | Must be a lockable rack or room with restricted physical access |
| GPU room(s) | Hosts contributing GPU machines | One or more labs; each must pass the thermal check in §7.2 |

Cat6a is run from the anchor rack to each GPU room. Cable lengths are measured on site during week 1; no estimate is used for procurement.

## 2.2 Physical access control

The anchor node holds the accounting database, the munge key authority, and all user home directories. Physical access to the anchor rack is restricted to the named systems administrator and the faculty sponsor. Compute nodes remain in their owning labs and are subject to normal lab access.

# 3. Bill of Materials

| # | Item | Specification | Qty | Notes |
| --- | --- | --- | --- | --- |
| 1 | Anchor node | 1× EPYC or Xeon (16 cores or more), 128 GB ECC RAM, 2× 1 TB NVMe (RAID1), 6× 8 TB HDD (RAIDZ2), dual 10 GbE, redundant PSU | 1 | **Must be purchased. Do not repurpose a desktop** |
| 2 | UPS | 3 kVA online, 30 minutes or more at load | 1 | Anchor node and switch only. Do not attempt to protect compute nodes |
| 3 | Switch | 24-port managed, 4× 10 GbE SFP+, 20× 1 GbE, VLAN and LACP capable | 1 | |
| 4 | Metered PDU | Per-outlet energy reporting, 8 outlets | 2 | Required for the energy baseline. Metered smart plugs are acceptable if a PDU cannot be procured |
| 5 | Cat6a cabling | Anchor rack to GPU room(s) | As measured | Measure on site in week 1 |
| 6 | GPU compute nodes | Existing lab hardware | 4–6 | Must pass the qualification checklist in the GPU/Hardware Inventory document |
| 7 | Spare GPU fund | Budget line, approximately 10% of pooled card value per year | — | Shared cards fail more often than personally owned ones |

Items 1–5 are the honest cost of a project described as requiring "zero new GPU purchases." They are named explicitly in the budget request rather than left for a reviewer to discover.

# 4. Network Design

## 4.1 Segmentation

Two VLANs, with a deliberate asymmetry between them.

| VLAN | Name | Subnet | Contains | Reachability |
| --- | --- | --- | --- | --- |
| 10 | User / campus | Existing DIU addressing | User laptops and desktops | Reaches the anchor node on TCP 443 only |
| 20 | Compute | `10.20.0.0/24` | Anchor (second interface) and all compute nodes | No inbound internet. Not routable from the staff VLAN. Egress only through a proxy allowlist |

The anchor node is dual-homed. It is the only device present on both VLANs and is therefore the only path between users and compute resources. Compute nodes are never directly addressable from a user workstation.

## 4.2 Addressing plan

| Item | Convention | Example |
| --- | --- | --- |
| Cluster name | `clusterone` | `ClusterName=clusterone` in `slurm.conf` |
| Hostnames | `c1-<role><NN>` | `c1-anchor`, `c1-gpu01` |
| Compute VLAN | 20 | `10.20.0.0/24` |
| Anchor | `.10` | `10.20.0.10` |
| GPU nodes | `.21`–`.40` | `c1-gpu01 = 10.20.0.21` |
| Portal FQDN | | `clusterone.diu.edu.bd` |
| Git repository | | `diu-cse/clusterone-infra` |

Addresses `.21`–`.40` are reserved for compute nodes, leaving room for growth to twenty nodes without renumbering. Addresses `.11`–`.20` are reserved for future control-plane services (backup slurmctld, secondary storage) added in Phase 2.

## 4.3 Ports and flows

| Source | Destination | Port | Purpose |
| --- | --- | --- | --- |
| User workstation (VLAN 10) | `c1-anchor` | TCP 443 | Portal (HTTPS). The only user-facing flow |
| `c1-anchor` | Compute nodes | TCP 6818 | slurmd |
| Compute nodes | `c1-anchor` | TCP 6817 | slurmctld |
| Compute nodes | `c1-anchor` | TCP 6819 | slurmdbd |
| All nodes | All nodes | UDP/TCP 4321 | munge authentication |
| Compute nodes | `c1-anchor` | TCP 2049 | NFSv4 |
| `c1-anchor` (Prometheus) | Compute nodes | TCP 9100 | node_exporter |
| `c1-anchor` (Prometheus) | Compute nodes | TCP 9400 | dcgm-exporter |
| Compute nodes (promtail) | `c1-anchor` | TCP 3100 | Loki log ingestion |
| Compute nodes | Egress proxy | TCP 3128 | Allowlisted package and model downloads |

All other traffic is denied by default at the host firewall (`ufw`, deployed by the `common` Ansible role) and at the switch where port-level ACLs are available.

## 4.4 Egress allowlist

Compute nodes have no unrestricted internet access. Outbound traffic passes through a proxy permitting only:

- PyPI and conda package repositories
- Hugging Face Hub
- GitHub
- Ubuntu and NVIDIA package repositories

This single control blocks both cryptocurrency mining and botnet participation, which are the two realistic abuse cases for pooled campus GPU capacity. It is described further in the Security Design document.

## 4.5 Name resolution and certificates

- `clusterone.diu.edu.bd` is reserved with DIU IT and resolves to the anchor node's VLAN 10 address.
- Internal names (`c1-anchor`, `c1-gpu01` …) resolve via `/etc/hosts` distributed by the `common` Ansible role, which removes a dependency on campus DNS for cluster-internal traffic.
- TLS certificate for the portal is issued by DIU IT or a public CA; renewal is automated and monitored by an Alertmanager rule.

## 4.6 Measured throughput, not assumed

Real inter-room throughput is measured with `iperf3` during week 3 and recorded in the network map before any storage design decision is finalised. The stage-to-scratch storage rule exists precisely because 1 GbE is the realistic link speed; if measurement shows worse (for example, a shared uplink saturated by other lab traffic), the affected room does not qualify for the `gpu` partition.

# 5. Storage Infrastructure

| Pool | Devices | Layout | Serves |
| --- | --- | --- | --- |
| `rpool` | 2× 1 TB NVMe | RAID1 (mirror) | OS, MariaDB, `/home` |
| `tank` | 6× 8 TB HDD | RAIDZ2 | `/projects`, `/datasets`, `/opt/apptainer`, backups |
| Node-local | 1× NVMe/SSD per compute node, 500 GB or more free | Single device | `/scratch` |

ZFS is used for both anchor pools, providing checksumming, snapshots (the basis of the backup procedure) and compression. RAIDZ2 tolerates two simultaneous disk failures, which is the appropriate level for a pool holding shared project data on a weekly backup cycle.

NFSv4 is exported over VLAN 20 only. `/datasets` and `/opt/apptainer` are exported read-only.

# 6. Compute Node Baseline

Pinned and version-locked. Mismatched drivers across nodes are the single most common cause of a job that works on one node and fails on another.

| Component | Version |
| --- | --- |
| Operating system | Ubuntu 24.04 LTS |
| NVIDIA driver | 550 or later — one version everywhere |
| CUDA | Provided inside containers, not installed on the host |
| Slurm | 24.05.x, from distro packages or built once and served from `/opt` |
| Apptainer | 1.3 or later |

```bash
# Hold the driver so unattended-upgrades cannot break the cluster overnight
apt-mark hold nvidia-driver-550 nvidia-dkms-550 libnvidia-compute-550
```

The version is asserted by Ansible on every playbook run, so drift is corrected automatically rather than discovered by a failed job.

# 7. Power, Cooling and Environment

## 7.1 Power

- The anchor node and the managed switch are on the UPS. Compute nodes are not; protecting six GPU machines is not economically justified and jobs are expected to checkpoint instead.
- Metered PDUs record per-outlet energy for the full twelve weeks. This is the source of the kWh-per-completed-job baseline, which is a pilot exit criterion.
- GPU power caps are applied through a systemd unit (`clusterone-gpu-power.service`) enabling persistence mode and setting the cap determined by the week-7 benchmark sweep. The value differs per card model and is committed to `roles/gpu_node/defaults/main.yml`.

## 7.2 Cooling and thermal gating

A room qualifies to host compute nodes only if it has air conditioning, or an overnight thermal log under sustained load shows GPU temperature staying below 80 °C. This log is produced in week 3, before any node is admitted.

Operationally, `GPUOverTemp` (above 85 °C for five minutes) automatically drains the affected node. `GPUTempWarning` (above 80 °C for ten minutes) notifies the operations team.

## 7.3 Energy measurements to record

| Measurement | Purpose |
| --- | --- |
| Node idle W, load W, suspended W | Business case for Phase 2 power saving |
| Cooling multiplier (room AC draw ÷ IT draw) | A real Dhaka figure; the commonly cited 1.35 is a placeholder |
| Total cluster kWh per month | Denominator for kWh per completed job |
| Overnight GPU temperature with AC off | Decides which rooms qualify for Phase 2 scavenging |

Annual cost is computed as:

```
Annual cost = kWh_measured_per_month x 12 x cooling_multiplier x tariff
```

using DIU's actual billed rate confirmed against a recent invoice. The June 2026 BERC education-institution tariff of Tk 9.05/kWh is used only as a placeholder until the invoice is obtained.

ClusterOne **increases** total campus electricity consumption — machines that were idle now run under load. The project reports efficiency of energy use (kWh per completed job, useful GPU-hours per kWh, avoided embodied carbon, avoided cloud spend), not reduction of consumption. Presenting it as an energy-saving initiative will not survive contact with the facilities office.

# 8. Infrastructure Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Anchor node failure | Medium | Critical | UPS, nightly backup, Ansible rebuild; backup slurmctld added in Phase 2 |
| Grid outage or generator cost | High | Medium | Anchor on UPS; compute jobs checkpoint; non-urgent compute paused during generator operation |
| Overnight thermal failure | High | Medium | Week-3 thermal log gates room eligibility; automatic drain at 85 °C |
| NFS bandwidth saturation | High | Medium | Stage-to-scratch enforced by prolog and job templates |
| Driver version drift across nodes | High | Medium | `apt-mark hold`; version asserted by Ansible on every run |
| VLAN or switch port request delayed by netops | Medium | High | Requested in week 1, before hardware arrives |
| Cabling underestimated | Medium | Low | Measured on site in week 1, not estimated |

# 9. Growth Path

The design supports growth without redesign:

- Addressing reserves `.21`–`.40`, allowing twenty compute nodes.
- Slurm partitions are defined by node lists; adding a node is an inventory change plus one playbook run.
- ZFS pools expand by adding vdevs.
- The 10 GbE SFP+ ports on the switch are unused in the pilot and become the anchor-to-core uplink when storage traffic justifies it.

Two changes are explicitly deferred until measurement justifies them: a 25 GbE fabric (required before multi-node distributed training is worth enabling) and a distributed filesystem (not justified below roughly 50 nodes).

# 10. Infrastructure Acceptance Criteria

Before the cluster is declared ready for users:

- [ ] VLAN 20 configured on the switch; anchor reachable on both VLANs
- [ ] `zpool status` reports both pools healthy
- [ ] `iperf3` throughput between anchor and every GPU room recorded in the network map
- [ ] UPS tested under load; runtime measured, not quoted
- [ ] Metered PDUs reporting per-outlet energy into Prometheus
- [ ] Thermal log completed for every participating room
- [ ] Portal FQDN resolving with a valid TLS certificate
- [ ] Egress allowlist verified: an unlisted destination is blocked from a compute node
- [ ] `id <user>` returns identical UID/GID on the anchor and every compute node
