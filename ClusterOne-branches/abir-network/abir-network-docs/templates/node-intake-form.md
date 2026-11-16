# Node Intake Form

Copy this file to `infrastructure/networking/inventory/<hostname>.md` and fill it in
before the node is cabled. Used in **N0.1** and **RB-01 Step 2**.

---

## Identity

| Field | Value |
|-------|-------|
| Assigned hostname | `gpuNN` |
| Assigned IP | `10.42.0.NN` |
| Role | compute / controller / storage |
| Physical location | bench / rack, position |
| Owner / donor of the machine | |
| Date added | |
| Status | planned / cabled / configured / production / retired |

## CPU & memory

```bash
lscpu | grep -E 'Model name|^CPU\(s\)|Thread|Socket'
free -h
```

| Field | Value |
|-------|-------|
| CPU model | |
| Cores / threads | |
| RAM total | |

## GPU

```bash
nvidia-smi --query-gpu=index,name,memory.total,driver_version,pci.bus_id --format=csv
```

| Field | Value |
|-------|-------|
| GPU model | |
| GPU count | |
| VRAM per GPU | |
| Driver version | |
| CUDA version | |

## Network (the section that matters most for my module)

```bash
ip -br link
lspci | grep -i -E 'ethernet|network'
sudo ethtool <iface> | grep -E 'Speed|Duplex|Link detected|Supported link modes'
```

| Field | Value |
|-------|-------|
| Interface name | `eno1` / `enp3s0` / … |
| **NIC chipset** | e.g. `Intel I219-V`, `Realtek RTL8111` |
| MAC address | |
| Max supported speed | 1000 / 2500 / 10000 Mb/s |
| Negotiated speed | must be `1000Mb/s` |
| Duplex | must be `Full` |
| Second NIC present? | yes/no — matters for bonding (N7.6) |
| Switch port | `SW01-P<nn>` |
| Cable category / length | Cat6 / 3 m |

> ⚠️ Record the NIC chipset. Realtek onboard NICs are a known risk (R2) for packet drops
> under sustained load. Knowing this up front turns a mysterious week-9 problem into a
> predicted week-1 note.

## Storage

```bash
lsblk -o NAME,SIZE,TYPE,MODEL,MOUNTPOINT
```

| Field | Value |
|-------|-------|
| OS disk | size, type |
| Scratch / staging disk | size, NVMe or SATA |
| Free space for dataset staging | |

## OS

| Field | Value |
|-------|-------|
| Distribution + version | Ubuntu 22.04 LTS |
| Kernel | `uname -r` |
| Netplan renderer | networkd |

---

## Qualification checklist (N1 exit criteria for this node)

- [ ] Link negotiates 1000 Mb/s full duplex
- [ ] 10-minute `iperf3` soak ≥ 900 Mbit/s
- [ ] No growth in `rx_errors` / `rx_dropped` / `rx_crc_errors` after the soak
- [ ] `ping -M do -s 8972` to the anchor succeeds (jumbo frames)
- [ ] Link comes back automatically after a power cycle
- [ ] Static IP survives a reboot
- [ ] `ssh` in from the anchor with no password
- [ ] `ssh` out to another node with no password

## Notes / anomalies

```text
(Anything unusual: a flaky port, a NIC that needed a driver, thermal concerns,
 a machine that can only stay for one semester, etc.)
```

## Sign-off

| | |
|---|---|
| Intake completed by | |
| Date | |
| Verified by | |
