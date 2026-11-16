# Reference — Glossary

Plain-English definitions for the rest of the team. Most of ClusterOne's members are not
networking people; this file exists so my reports and PRs are readable without a
networking course.

---

## Cluster terms

| Term | Meaning |
|------|---------|
| **Anchor / head / controller node** | The one machine that runs the brain: scheduler, API, DNS, monitoring. Ours is `anchor01`. |
| **Compute node** | A machine that runs jobs. Ours are `gpu01`–`gpuNN`. |
| **Fabric** | The private network that connects cluster machines to each other. Not the campus network. |
| **Node agent** | Tanvir's program on each compute node that reports CPU/RAM/GPU to the controller. |
| **Drain** | Marking a node so Slurm stops sending it new jobs, without killing running ones. |

## Networking basics

| Term | Meaning |
|------|---------|
| **Subnet** | A block of IP addresses that can talk directly. `10.42.0.0/24` = addresses `10.42.0.0`–`10.42.0.255`. |
| **`/24`** | How many bits are fixed. `/24` = 256 addresses; `/29` = 8. Bigger number, smaller network. |
| **Gateway** | The machine packets go to when the destination isn't on this subnet. Ours is `anchor01`. |
| **VLAN** | A way to make one physical switch behave like several separate switches. Needs a managed switch. |
| **MTU** | The largest packet that fits on the wire. Default 1500; ours is 9000 ("jumbo frames"). |
| **Jumbo frames** | MTU 9000. ~6× fewer packets per gigabyte → less CPU, faster bulk transfer. |
| **NAT** | Letting many private machines share one public address. Our nodes reach the internet through the anchor this way. |
| **Managed vs unmanaged switch** | Managed = configurable (VLANs, LACP, port stats). Unmanaged = plug and pray. |
| **LACP / bonding** | Combining two NICs into one logical link for more aggregate bandwidth. |
| **ARP** | How a machine finds the MAC address behind an IP. Stale ARP entries cause confusing "it was working" bugs. |

## Measurement

| Term | Meaning |
|------|---------|
| **Bandwidth** | How much data per second. 1 GbE ≈ 118 MB/s in practice. |
| **Latency (RTT)** | How long a round trip takes. Ours: ~0.2 ms idle. |
| **Jitter** | How much latency varies. High jitter hurts synchronous workloads like DDP. |
| **Packet loss** | Packets that never arrived. On a wired LAN this should be exactly 0%. |
| **Bufferbloat** | A switch buffering so much under load that latency balloons. Great throughput, terrible responsiveness. |
| **`iperf3`** | The tool that measures bandwidth between two machines. |
| **`ethtool`** | Shows what speed/duplex a NIC actually negotiated — not what you assumed. |
| **Line rate** | The theoretical maximum (1000 Mbit/s on 1 GbE). Real TCP tops out ~940. |

## Distributed training

| Term | Meaning |
|------|---------|
| **DDP** | PyTorch Distributed Data Parallel — each GPU has a full model copy and they sync gradients each step. |
| **All-reduce** | The operation that sums gradients across all GPUs and gives everyone the result. |
| **NCCL** | NVIDIA's library that implements all-reduce over PCIe/NVLink/network. |
| **Ring all-reduce** | NCCL's default pattern — data flows around a ring of GPUs. Moves ~2× model size per GPU. |
| **`torchrun`** | The launcher that starts one process per GPU across nodes. |
| **Rendezvous** | How the processes find each other at startup (`MASTER_ADDR` + `MASTER_PORT`). |
| **busbw** | "Bus bandwidth" from `nccl-tests` — the number to compare fabrics with. |
| **Gradient accumulation** | Doing several backward passes before syncing. Cuts network traffic proportionally. |
| **Communication-bound** | The GPUs sit idle waiting for the network. Our expected state on 1 GbE. |

## Security / access

| Term | Meaning |
|------|---------|
| **Key-based auth** | Logging in with a cryptographic key instead of a password. Required here. |
| **`authorized_keys`** | The file listing which public keys may log in as a user. |
| **`known_hosts`** | The file recording which server key you've seen before — prevents impersonation. |
| **ProxyJump / jump host** | Reaching an internal machine by hopping through a gateway. Ours is `anchor01`. |
| **Default deny** | The firewall blocks everything not explicitly allowed. Our policy. |
| **nftables** | The modern Linux firewall (replaces iptables). |
| **Egress** | Traffic leaving the cluster. Ours goes through the anchor and is allowlisted. |

## Storage

| Term | Meaning |
|------|---------|
| **NFS** | Network File System — mounting a remote directory as if it were local. |
| **`hard` mount** | On a network blip, the client blocks and retries. Correct for clusters. |
| **`soft` mount** | On a blip, the client returns an I/O error. Can corrupt training checkpoints. Never use it. |
| **Staging** | Copying a dataset to fast local disk before training, instead of reading it over the network every epoch. |
| **`rsize`/`wsize`** | How much NFS reads/writes per operation. 1 MB pairs well with MTU 9000. |

---

## Commands worth knowing

```bash
ip -br addr             # my addresses, one line per interface
ip -br link             # my interfaces and their MACs
ip route                # where packets go
ethtool eno1            # actual link speed and duplex
ping -c4 gpu02          # can I reach it, and how fast
ping -M do -s 8972 gpu02   # does MTU 9000 really work end to end
iperf3 -c gpu02         # how fast is this link
ss -tulpn               # what is listening on this machine
nft list ruleset        # what the firewall currently allows
dig gpu02.clusterone.internal   # what does DNS say
tracepath gpu02         # the path and its MTU
journalctl -u ssh -f    # why did that SSH attempt fail
```
