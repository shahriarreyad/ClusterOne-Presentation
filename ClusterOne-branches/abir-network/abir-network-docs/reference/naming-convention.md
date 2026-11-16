# Reference — Naming Convention

> ⚠️ **Contract file.** Slurm, the node agent, Prometheus and the backend all key off
> these names. Renaming a node later touches five modules.

---

## 1. Hostnames

```text
Controller / head node:  anchor01, anchor02, …
Compute (GPU) nodes:     gpu01, gpu02, … gpu40
Storage node (if split): store01
Login node (if split):   login01
Switch:                  sw01
```

**Rules:**

| Rule | Reason |
|------|--------|
| Lowercase only | DNS is case-insensitive but tooling isn't consistently |
| No underscores | Underscores are not valid in DNS hostnames (RFC 1123) |
| Zero-padded 2-digit index | `gpu01` sorts before `gpu10`; `gpu1` does not |
| Role prefix, then index | `gpu03` groups naturally; `lab-pc-3` says nothing |
| Max 15 chars | Keeps legacy tooling and Slurm node-name expressions happy |
| Never encode hardware in the name | `gpu01-rtx3060` breaks the day the card is swapped |

**Why `anchor01` and not `master`/`head`:** it matches the project's own vocabulary
("Anchor = brain"), and the `01` leaves room for a second controller without renaming
the first.

---

## 2. Domain and FQDNs

```text
Internal domain:  clusterone.internal
FQDN:             gpu01.clusterone.internal
Search domain:    clusterone.internal   (so `ping gpu01` works bare)
```

**Why `.internal` and not `.local`:** `.local` is reserved by mDNS/Avahi (RFC 6762).
Using it causes intermittent, maddening resolution failures on Linux desktops. `.internal`
is the conventional private choice and is now formally reserved for exactly this.

Public-facing name (campus DNS, Rahat/Zafor's to arrange):
```text
clusterone.diu.edu.bd  →  anchor01's campus IP
```

---

## 3. Interface naming

| Name | Meaning |
|------|---------|
| `eno1` | First onboard NIC — campus uplink on the anchor, fabric on compute nodes |
| `eno2` | Second onboard NIC — cluster fabric on the anchor |
| `enp3s0` | PCIe add-in NIC (bus-slot named) |
| `bond0` | LACP bond, if N7.6 bonding is adopted |

Interface names differ between machines and that's a real operational problem — NCCL and
firewall rules reference them. Two options:

- **Normalise** with a systemd `.link` file so the fabric NIC is `net0` on every node, or
- **Record per-node** in the inventory table and template the configs.

The pilot uses the second (simpler); note the first as a cleanup for N9.

**Optional alias convention** for multi-fabric nodes, once `net-fast` exists:

```text
gpu01      → fabric address   (10.42.0.21)
gpu01-f    → fast fabric      (10.42.1.21)
gpu01-c    → campus, if ever  (rare)
```

`NCCL_SOCKET_IFNAME` then points at the fast interface while control traffic stays on the
main one.

---

## 4. Slurm alignment (important)

Slurm's `NodeName` must match `hostname -s` **exactly**. Mismatches produce
`Node X not found` errors that look like config problems and are naming problems.

```conf
# slurm.conf — Rahat's file, but these names come from here
NodeName=gpu[01-05] CPUs=16 RealMemory=32000 Gres=gpu:1 State=UNKNOWN
PartitionName=compute Nodes=gpu[01-05] Default=YES MaxTime=INFINITE State=UP
```

The bracket expression `gpu[01-05]` is exactly why zero-padded sequential names matter —
it works with `pdsh`, Slurm, and Ansible identically.

---

## 5. Naming for everything else

| Thing | Convention | Example |
|-------|-----------|---------|
| Git branch | `abir/network` (already set) | `abir/network` |
| Config files | `<component>.<role>.<ext>` | `nftables.compute.nft` |
| Reports | `<phase>-<topic>.md` | `N5-baseline.md` |
| Runbooks | `RB-NN-kebab-case.md` | `RB-02-node-unreachable.md` |
| Switch ports (labels) | `SW01-P<nn>` | `SW01-P04` |
| Cable labels | `<node>-<iface> ⇄ SW01-P<nn>` | `gpu03-eno1 ⇄ SW01-P04` |
| VLANs | `net-<purpose>` | `net-cluster`, `net-fast` |
| SSH keys | `clusterone_<purpose>` | `clusterone_admin` |

---

## 6. Renaming procedure (if it ever has to happen)

Renaming is expensive. If unavoidable:

1. PR against `ip-address-plan.md` + `nodes.csv` — announce before merging
2. Regenerate `/etc/hosts` and dnsmasq; push everywhere
3. Regenerate `ssh_known_hosts` (old entries will mismatch and block automation)
4. Update `slurm.conf` and restart `slurmctld` — Rahat
5. Update Prometheus targets — Zafor
6. Update the node agent's identity — Tanvir
7. `hostnamectl set-hostname` on the node, reboot
8. Re-run `netcheck.sh` and `port-check.sh` cluster-wide

Steps 3–6 are the ones people forget, and each fails silently at first.
