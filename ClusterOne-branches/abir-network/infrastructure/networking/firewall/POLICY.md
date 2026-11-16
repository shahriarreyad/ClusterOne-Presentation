# ClusterOne firewall policy

Source of truth for ports: `abir-network-docs/reference/port-matrix.md`, mirrored machine-readably in `port-matrix.tsv`. Change both in the same PR.

## 1. Model
- Default **deny** inbound on every node (`input policy drop`), forward drop on compute nodes.
- ICMP is always allowed — it is the first diagnostic tool on a cluster.
- Our rules live in **our own tables** (`inet clusterone`, `ip clusterone_nat`). We never `flush ruleset` and never persist with `nft list ruleset >`; either would wipe or freeze fail2ban's and Docker's tables.
- Deploy only with `apply-firewall.sh` (or the Ansible play). It syntax-checks, snapshots, loads, and **rolls back automatically** unless you confirm from a second SSH session.

## 2. Files
| File | Purpose |
|---|---|
| `compute.nft` | ruleset for gpu01–gpu05 |
| `anchor.nft` | ruleset + NAT for anchor01 (includes the egress file) |
| `egress-open.nft` | N4 egress: allow all NAT'd traffic |
| `egress-allowlist.sh` + `egress-domains.txt` | N8 egress: domain allowlist → nft set (timer refresh) |
| `port-matrix.tsv` | data for `scripts/port-check.sh` |

## 3. Notable decisions
- **node↔node SSH stays open.** Distributed training (torchrun/MPI) needs it, and N3 sets up shared-home trust. The docs' "only the anchor may SSH to compute" rule would break DDP; the enforceable boundary is the fabric itself (no campus route in).
- **5201 (iperf3) is not permanently open.** `scripts/bench-fw.sh` inserts a temporary accept in the empty `bench` chain and removes it after measuring.
- **NFS:** v4 only needs 2049. `mountd` is pinned to 20048 (`nfs/`) so it can be firewalled; statd/lockd ports are opened only if v3 is confirmed.
- **Agent port 9500 is a placeholder** (marked `tbc` in the matrix) until the agent's owner confirms it.
- **MSS clamp** on the anchor forward path: fabric MTU 9000, campus 1500.

## 4. Egress (ADR-N6, N8)
Compute nodes reach the internet only through the anchor's NAT.
- **N4:** open (`egress-open.nft`).
- **N8:** allowlist by domain. `egress-allowlist.sh --temp-web-until DATE` optionally keeps a *dated* broad 80/443 rule; after that date it is dropped automatically.
- Campus DNS/NTP are **not** in the forward allowlist: nodes use the anchor for both.

## 5. Limits of an IP allowlist
CDN-backed hosts (Hugging Face, PyPI, GitHub) rotate addresses; a 15-minute refresh narrows but never closes the gap, and shared CDN IPs admit other tenants. An HTTP proxy that filters by hostname (e.g. squid `dstdomain`) is the robust follow-up if this policy needs to be strict.

## 6. Changing a rule
1. Edit the `.nft` file **and** `port-matrix.md` + `port-matrix.tsv`.
2. `make check`, then `apply-firewall.sh <role> --dry-run`.
3. Apply on one node first, run `scripts/port-check.sh`, then roll out.
