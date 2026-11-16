# ClusterOne — GPU & Hardware Inventory



*Version 1.0 — Register template and qualification standard*

| **Field** | **Detail** |
| --- | --- |
| Document | GPU / Hardware Inventory |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Target Environment | DIU Campus |
| Status | **Template — awaiting week 1 lab survey.** Structure and qualification rules are final; the machine rows are populated during the physical walk |
| Owner | Systems administrator, with the faculty sponsor countersigning each MOU |

> **Note on completeness.** The participating machine list cannot be filled in from documentation. It requires a physical visit to each candidate lab, a BIOS check, an overnight thermal log, and a signed owner MOU. Sections 1–4 and 7 below are complete and binding; Sections 5 and 6 are the registers to be populated in weeks 1–3, and are marked accordingly.

# 1. Purpose

This document is the authoritative register of every physical asset in ClusterOne: the purchased control-plane hardware, the contributed GPU machines, their specifications, locations, and owners. It also defines the qualification standard a machine must meet before it may join the cluster.

A machine that is not in this register is not part of ClusterOne.

# 2. Purchased Infrastructure

These items are procured for the project and owned by the department rather than by an individual lab.

| Asset ID | Item | Specification | Qty | Location | Status |
| --- | --- | --- | --- | --- | --- |
| C1-ANCHOR-01 | Anchor node | EPYC/Xeon 16c+, 128 GB ECC, 2× 1 TB NVMe (RAID1), 6× 8 TB HDD (RAIDZ2), dual 10 GbE, redundant PSU | 1 | Anchor rack | Pending procurement |
| C1-UPS-01 | UPS | 3 kVA online, ≥30 min at load | 1 | Anchor rack | Pending procurement |
| C1-SW-01 | Managed switch | 24-port, 4× 10 GbE SFP+, 20× 1 GbE, VLAN + LACP | 1 | Anchor rack | Pending procurement |
| C1-PDU-01/02 | Metered PDU | Per-outlet energy reporting, 8 outlets | 2 | Anchor rack / GPU room | Pending procurement |
| C1-CBL-* | Cat6a cabling | Anchor rack to GPU rooms | As measured | — | Length to be measured week 1 |

The anchor node must be purchased, not repurposed. Every service in the cluster depends on it, and running the control plane on a borrowed desktop is the most common cause of pilot failure in month four.

# 3. GPU Node Qualification Checklist

A machine joins the pilot only if **every** box is ticked. The completed checklist is recorded per machine in §5.

| # | Criterion | Why it matters |
| --- | --- | --- |
| 1 | GPU compute capability ≥ 6.0 | Current PyTorch builds will not run below this |
| 2 | VRAM ≥ 8 GB for the `gpu` partition; ≥ 4 GB for `teaching` | Below 8 GB, realistic research training batches will not fit |
| 3 | System RAM ≥ 32 GB, and at least 2× total VRAM | Data loading stalls otherwise |
| 4 | ≥ 500 GB free local NVMe/SSD for `/scratch` | The stage-to-scratch rule depends on it |
| 5 | 1 GbE minimum, with the switch port confirmed and documented | An undocumented port becomes an outage nobody can trace |
| 6 | Wake-on-LAN available in BIOS **and enabled** | Needed for Phase 2 power saving. Requires a physical visit, so it is done during the week 1 walk, not later |
| 7 | Room has air conditioning, **or** an overnight thermal log shows sustained load below 80 °C | Thermal failure is the most likely cause of node loss |
| 8 | Owner has signed the MOU | Determines reclaim, damage and opt-out terms |
| 9 | Machine can be reimaged — no irreplaceable local data | Nodes are built from Ansible, not adapted in place |

A machine failing only criterion 2 (VRAM between 4 GB and 8 GB) may still qualify for the `teaching` partition. A machine failing any other criterion does not join.

# 4. Fields Recorded Per Machine

The asset register spreadsheet (`docs/asset-register.xlsx` in the infrastructure repository) carries one row per candidate machine with the following columns.

| Field | Example / notes |
| --- | --- |
| Asset ID | `C1-GPU01` |
| Assigned hostname | `c1-gpu01` |
| Assigned IP | `10.20.0.21` |
| Physical location | Building, floor, room, rack or bench position |
| Owning lab / department | |
| Owner name and contact | The person who signs the MOU |
| Chassis make and model | |
| CPU model and core count | |
| System RAM (GB) | |
| GPU model | |
| GPU count | |
| VRAM per card (GB) | |
| Compute capability | e.g. 8.9 |
| Local scratch device and free capacity | |
| Network speed and switch port | e.g. 1 GbE, sw01 port 14 |
| Wake-on-LAN enabled | Yes / No |
| Room AC present | Yes / No |
| Overnight max GPU temp (°C) | From the week-3 thermal log |
| Measured idle power (W) | From the metered PDU |
| Measured load power (W) | From the metered PDU |
| Chosen power cap (W) | From the week-7 sweep |
| MOU signed date | |
| Qualification result | Qualified `gpu` / Qualified `teaching` / Rejected — with reason |
| Target partition | `gpu` / `teaching` |
| Date joined cluster | |
| Notes | Warranty status, known faults, reclaim conditions |

# 5. Participating GPU Node Register

**Status: pending — to be completed during the week 1–3 lab survey.**

| Asset ID | Hostname | IP | Location | Owner | GPU model | Qty | VRAM | CC | RAM | Scratch | Net | WoL | MOU | Partition | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1-GPU01 | c1-gpu01 | 10.20.0.21 | | | | | | | | | | | | `gpu` | Pending survey |
| C1-GPU02 | c1-gpu02 | 10.20.0.22 | | | | | | | | | | | | `gpu` | Pending survey |
| C1-GPU03 | c1-gpu03 | 10.20.0.23 | | | | | | | | | | | | `gpu` | Pending survey |
| C1-GPU04 | c1-gpu04 | 10.20.0.24 | | | | | | | | | | | | `gpu` | Pending survey |
| C1-GPU05 | c1-gpu05 | 10.20.0.25 | | | | | | | | | | | | `teaching` | Pending survey |
| C1-GPU06 | c1-gpu06 | 10.20.0.26 | | | | | | | | | | | | `teaching` | Pending survey |

Addresses `.21` through `.40` are reserved for compute nodes, allowing growth to twenty nodes without renumbering.

## 5.1 Reference configuration used in the Slurm draft

The `slurm.conf` draft in the configuration reference assumes the following node classes. These are **placeholders** and are corrected from the completed register before the first job runs.

| Node group | CPUs | RealMemory | GRES |
| --- | --- | --- | --- |
| `c1-gpu[01-04]` | 16 | 64000 | `gpu:2` (whole cards, `gpu` partition) |
| `c1-gpu[05-06]` | 8 | 32000 | `gpu:1,mps:100` (`teaching` partition) |

# 6. Rejected and Deferred Candidates

**Status: pending — to be completed during the week 1–3 lab survey.**

| Machine | Location | Reason not admitted | Reconsider when |
| --- | --- | --- | --- |
| | | | |

Recording rejections matters as much as recording admissions. A machine turned down for thermal reasons will be offered again in month five by someone who does not remember the first conversation.

# 7. Lifecycle and Maintenance

## 7.1 Adding a machine

1. Complete the §3 checklist during a physical visit; enable Wake-on-LAN while present.
2. Owner signs the MOU (see the GPU Sharing & Governance Policy document).
3. Record the machine in §5 with a status of *Admitted, not yet built*.
4. Reimage to Ubuntu 24.04 LTS.
5. Add to the Ansible inventory under `gpu_nodes` and run `playbooks/compute.yml --limit <host>`.
6. Run the validation job; confirm `sinfo` reports the node `IDLE`.
7. Update the register with the join date.

## 7.2 Removing a machine

1. `scontrol update NodeName=<host> State=DRAIN Reason="owner reclaim"`.
2. Wait for running jobs to complete, or requeue them.
3. Confirm no user data remains in node-local `/scratch`.
4. Remove from the Ansible inventory and from `slurm.conf`; run the playbook.
5. Update the register with the removal date and reason. **Do not delete the row.**

## 7.3 Failure and replacement

GPU failures are handled through the monitoring alerts `GPUEccError` (drain, do not reallocate) and `GPUOverTemp` (automatic drain). A card that has produced a double-bit ECC error is removed from service and recorded in the register regardless of whether it appears to keep working.

A spare GPU fund covering roughly 10% of the pooled card value per year is held as a budget line. Shared cards fail more often than personally owned ones, and a pooled resource with no replacement budget degrades silently.

## 7.4 Review cadence

The register is reviewed at the end of every month of the pilot and after any node addition, removal or failure. It is stored in the Git repository so that its history is itself an audit trail.

# 8. Outstanding Actions

| Action | Owner | Due |
| --- | --- | --- |
| Walk the top five candidate labs and complete the §3 checklist per machine | Systems administrator | Week 1 |
| Enable Wake-on-LAN in BIOS on every candidate while physically present | Systems administrator | Week 1 |
| Create the asset register spreadsheet with the §4 columns | Student operator | Week 1 |
| Install metered PDUs and begin power logging | Systems administrator | Week 2 |
| Record overnight GPU thermal log per candidate room, AC off | Student operator | Week 3 |
| Circulate the Owner MOU to one friendly lab head | Faculty sponsor | Week 3 |
| Finalise §5 and issue version 1.1 of this document | Systems administrator | End of week 3 |
