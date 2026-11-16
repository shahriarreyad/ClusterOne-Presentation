# ClusterOne — GPU Sharing & Governance Policy



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | GPU Sharing & Governance Policy |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Applies to | Hardware owners, users, and the operations team |
| Approved by | Faculty sponsor (signature required, §11) |
| Status | Draft — Pilot / Phase 1 |

# 1. Purpose

ClusterOne is built from machines that belong to other people. This document sets out the terms on which those machines are contributed, how the pooled capacity is divided between users, what an owner is guaranteed in return, and how disputes are resolved.

Its central premise: **participation is voluntary, and the terms must be good enough that a lab head signs willingly.** A cluster assembled by administrative instruction rather than by agreement loses its nodes the first time an owner is inconvenienced.

# 2. Scope and Definitions

| Term | Meaning |
| --- | --- |
| Owner | The lab, department or individual who holds the asset record for a contributed machine |
| Contributed node | A machine admitted to ClusterOne under a signed MOU |
| Pool | The total GPU capacity available to the scheduler |
| Reclaim | An owner taking their machine back, temporarily or permanently |
| Fairshare | The Slurm mechanism that lowers a heavy user's priority relative to a light one |
| Operations team | The systems administrator and student operators |

This policy applies to the pilot. Scavenging and preemption — where a job is suspended so an owner can use their own machine interactively — are **not** part of the pilot. The pilot runs on always-on, fully contributed nodes. Preemption arrives in Phase 2, and this policy is revised before it does.

# 3. Ownership Model

Contributing a machine to ClusterOne does **not** transfer ownership. The asset stays on the owner's inventory. What the owner contributes is *availability*: the machine is reimaged, joined to the cluster, and made available to the scheduler for the agreed period.

| The owner keeps | The cluster takes on |
| --- | --- |
| Legal ownership of the hardware | Operating system, drivers, and all software configuration |
| The right to reclaim under §6 | Physical and thermal monitoring |
| Fairshare credit proportional to the contribution | Responsibility for security controls on the node |
| A named contact in the operations team | Responsibility for a documented rebuild path |

The owner gives up the right to log in to the machine outside the cluster's access controls, and the right to keep local data on it. A contributed machine is reimaged; nothing on its disks survives admission.

# 4. Admission Criteria

A machine is admitted only when every criterion in the GPU/Hardware Inventory qualification checklist is met and the MOU is signed. In summary: compute capability 6.0 or higher, adequate VRAM and system RAM, 500 GB or more of free local scratch, a confirmed and documented switch port, Wake-on-LAN enabled, a room that passes the thermal check, and no irreplaceable local data.

Admission is a decision of the operations team, countersigned by the faculty sponsor. Refusals are recorded with a reason, because a machine turned down on thermal grounds will be offered again in month five by someone who does not remember the first conversation.

# 5. Partition and Priority Policy

Pooled capacity is divided by partition rather than by owner. This is deliberate: dividing by owner would recreate the fragmented, idle-GPU situation the project exists to fix.

| Partition | Nodes | Max walltime | Priority tier | Intended for |
| --- | --- | --- | --- | --- |
| `interactive` | Subset of `gpu` nodes | 8 h | 20 (highest) | Notebooks, debugging, portal sessions |
| `gpu` | Whole cards | 24 h | 10 | Research training runs |
| `teaching` | MPS-shared cards | 4 h | 5 (lowest) | Coursework |

Two rules follow from this table and are not negotiable:

1. **Coursework is never blocked by research.** The `teaching` partition has dedicated nodes. A twenty-hour training run cannot occupy a card that a class needs on Thursday.
2. **Interactive work jumps the queue, but only briefly.** `interactive` carries the highest priority tier and the shortest walltime. This is what makes the portal feel responsive, and the short walltime is what stops it from becoming a way to bypass the queue.

## 5.1 Fairshare

Priority is computed with the multifactor plugin, weighted overwhelmingly toward fairshare (100000) with age (10000), job size (1000) and QOS (50000) contributing. The decay half-life is seven days.

In practice: heavy recent use lowers your priority relative to light users, and the effect fades within about a week. There is no hard monthly quota, because a hard quota produces the wrong behaviour — users spend the quota to avoid losing it.

## 5.2 Owner fairshare credit

Owners receive fairshare credit for contributing hardware. The credit is applied as a raised share value on the owner's `research-<lab>` account, proportional to the GPU capacity contributed and the fraction of the period for which it was available.

Credit affects **priority**, not entitlement. An owner with credit waits less, but does not receive a reserved card. Reservation would return the cluster to the fragmented state it was built to replace.

The exact share values are set by the operations team, published, and reviewed monthly. Publication is the control that keeps the scheme trusted.

# 6. Reclaim Rights

## 6.1 Pilot terms

During the pilot there is **no automatic preemption**. An owner needing their machine back follows one of two paths:

| Path | Notice | Procedure | Latency |
| --- | --- | --- | --- |
| Planned reclaim | 5 working days | Owner notifies the operations team; the node is drained; running jobs complete or are requeued elsewhere | Up to the maximum walltime of the partition (4–24 h) |
| Urgent reclaim | Immediate | Owner contacts the operations team; the node is drained and running jobs are requeued | Typically under 15 minutes; jobs lose unsaved progress |

Urgent reclaim is available without justification. The operations team does not judge whether an owner's need is sufficient — that judgement would make owners reluctant to join.

Owners are asked to prefer planned reclaim, because urgent reclaim costs another user their work. This is a request, not a condition.

## 6.2 Permanent withdrawal

An owner may withdraw a machine permanently with 10 working days' notice. The operations team drains the node, confirms no user data remains in local scratch, removes it from the inventory and configuration, and records the withdrawal and its reason in the asset register. The machine is returned reimaged or as agreed in the MOU.

Fairshare credit ceases at withdrawal. It is not clawed back retrospectively.

## 6.3 Phase 2 change

When scavenging and preemption are enabled in Phase 2, urgent reclaim latency becomes a measured and published figure (target: p95 under a stated number of minutes), and jobs on scavenged nodes are suspended rather than requeued. This policy is revised and re-signed before that change takes effect. **Owners are not opted in to Phase 2 terms by having signed the pilot MOU.**

# 7. Owner Memorandum of Understanding

Every contributed machine is covered by a signed MOU containing, at minimum:

1. **Identification** — machine, asset ID, owner, location, contribution period.
2. **Reclaim guarantee** — the terms in §6, with the measured latency figure once available.
3. **Fairshare credit** — the share value granted and the review cadence.
4. **Damage and warranty** — who bears the cost of a failed card, how warranty status is preserved, and the operation of the spare GPU fund.
5. **Data** — the machine is reimaged on admission; no local data survives; no user data is left on it at withdrawal.
6. **Support commitments** — response times from the operations team, and the named contact.
7. **Opt-out procedure and notice period** — §6.2.
8. **Signatures** — owner and faculty sponsor.

# 8. Wear, Failure and Replacement

Shared cards fail more often than personally owned ones, because they run under sustained load rather than intermittently.

- A **spare GPU fund** covering approximately 10% of the pooled card value per year is held as a departmental budget line. It exists so that a failed contributed card is replaced rather than argued about.
- Power caps set from the week-7 benchmark sweep reduce thermal stress at a cost of under 10% throughput. Applying them is a condition of participation.
- Automatic drain at 85 °C and the `GPUEccError` rule (drain, do not reallocate) protect contributed hardware from being run to destruction.
- Failure of a card during cluster use is presumed to be normal wear and is covered by the spare fund, unless the machine was operated outside its documented thermal envelope, in which case the operations team records the cause.

# 9. User Obligations

Users are subject to the Acceptable Use Policy, and specifically:

- Do not hold a GPU allocation you are not using. The `GPUIdleWhileAllocated` rule notifies you after 30 minutes of near-zero utilisation. Repeat offences result in reduced QOS limits.
- Request the time you need, not the maximum. Shorter requests are scheduled sooner and improve utilisation for everyone.
- Checkpoint your work. Jobs that cannot resume are the reason urgent reclaim is expensive.
- Stage datasets to `/scratch`. Reading directly from NFS degrades the cluster for every other user simultaneously.

Enforcement escalates: notification, then reduced QOS limits, then suspension of the Slurm association, then referral to the department.

# 10. Governance and Review

| Body | Composition | Cadence | Decides |
| --- | --- | --- | --- |
| Operations team | Systems administrator, student operators | Weekly | Day-to-day admission, drain, alert response, QOS adjustments |
| Governance review | Faculty sponsor, systems administrator, two owner representatives, one user representative | Monthly during the pilot | Share values, partition sizing, admission and refusal appeals, policy changes |

**Transparency requirements.** The following are published on the wall board and in the user documentation, and are not discretionary:

- Median queue wait per partition
- GPU utilisation
- Active users and completed jobs
- Owner share values

A sharing scheme that cannot be inspected will not be trusted, and an untrusted scheme loses contributors.

## 10.1 Disputes

A user or owner who disagrees with an operations decision raises it with the systems administrator first, then with the governance review, then with the faculty sponsor, whose decision is final for the pilot. Disputes and their outcomes are recorded.

# 11. Approval

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Faculty sponsor | | | |
| Systems administrator | | | |
| Owner representative | | | |

# 12. Review Schedule

This policy is reviewed at the end of the pilot, before Phase 2 scavenging is enabled, and thereafter annually. Version history is maintained in the Git repository, which makes the record of changes an audit trail in itself.
