# RB-01 — Add a New Node to ClusterOne

**When:** A new PC is joining the cluster.
**Who can run this:** Anyone on the team, following these steps exactly.
**Time:** ~45 minutes.
**Escalate to:** Abir, if any verification step fails twice.

---

## Before you start

- [ ] The machine has Ubuntu 22.04+ installed
- [ ] You have physical access and a free switch port
- [ ] You have a Cat6 cable
- [ ] You know the next free hostname and IP from
      [`ip-address-plan.md`](../reference/ip-address-plan.md)

---

## Step 1 — Reserve identity (do this FIRST, in git)

1. Open `reference/ip-address-plan.md`, pick the next free `gpuNN` and its IP
   (`gpuNN → 10.42.0.(20+NN)`).
2. Add a row to the table and a line to
   `infrastructure/networking/inventory/nodes.csv`.
3. Commit on a branch, open a PR. **Do not skip this** — everything downstream is
   generated from these two files.

✅ **Verify:** the node has exactly one row in the table and one line in the CSV.

---

## Step 2 — Hardware intake

Fill [`templates/node-intake-form.md`](../templates/node-intake-form.md) by running on the
new machine:

```bash
hostnamectl
lscpu | grep -E 'Model name|^CPU\(s\)'
free -h
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
ip -br link                      # record the MAC and the interface name
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT
```

✅ **Verify:** GPU is detected, and you have written down the MAC and the interface name
(it may be `eno1`, `enp3s0`, or something else — this matters later).

---

## Step 3 — Physical connection

1. Plug into a free switch port.
2. Label the cable at both ends: `gpuNN-<iface> ⇄ SW01-P<nn>`.
3. Add the row to `inventory/cable-map.md`.

```bash
sudo ethtool <iface> | grep -E 'Speed|Duplex|Link detected'
```

✅ **Verify:** `Speed: 1000Mb/s`, `Duplex: Full`, `Link detected: yes`.
❌ If not: swap the cable, then the port. Do not continue with a 100 Mb link.

---

## Step 4 — Network configuration

Copy the netplan template and edit the address and interface name:

```bash
sudo cp /path/to/infrastructure/networking/netplan/compute.yaml \
        /etc/netplan/01-clusterone.yaml
sudo nano /etc/netplan/01-clusterone.yaml     # set addresses: and the interface name
sudo chmod 600 /etc/netplan/01-clusterone.yaml
sudo netplan try                              # auto-reverts in 120 s if something breaks
sudo netplan apply
```

Set the hostname:

```bash
sudo hostnamectl set-hostname gpuNN
```

✅ **Verify:**
```bash
ip -br addr          # shows the planned IP with /24 and mtu 9000
hostname -s          # shows gpuNN
ping -c2 anchor01    # reaches the controller
```

---

## Step 5 — Name resolution

On `anchor01`, regenerate and push:

```bash
cd infrastructure/networking
./dns/hosts.generate.sh inventory/nodes.csv > /tmp/hosts.block
ansible-playbook ansible/push-hosts.yml
sudo systemctl restart dnsmasq
```

✅ **Verify from the new node AND from an existing node:**
```bash
ping -c1 gpuNN        # from anchor01 and from gpu01
getent hosts gpuNN
```
Both directions must work. One-way resolution is the classic half-finished state.

---

## Step 6 — SSH trust

```bash
# on anchor01 — push the orchestration key
ssh-copy-id -i ~/.ssh/id_ed25519.pub clusterone@gpuNN

# regenerate global known_hosts with the new node included
ssh-keyscan -t ed25519 -H gpuNN 10.42.0.<20+NN> >> /etc/ssh/ssh_known_hosts
ansible-playbook ansible/push-known-hosts.yml

# apply the sshd baseline
ansible-playbook ansible/ssh-baseline.yml --limit gpuNN
```

✅ **Verify:**
```bash
ssh gpuNN hostname                 # from anchor01, no prompt
ssh gpu01 'ssh gpuNN hostname'     # node → node, no prompt
```

---

## Step 7 — Firewall

```bash
ansible-playbook ansible/firewall.yml --limit gpuNN
ssh gpuNN 'sudo nft list ruleset | head -30'
```

✅ **Verify:** `./scripts/port-check.sh gpuNN` passes, including its negative tests.

---

## Step 8 — Performance check

```bash
# on the new node
iperf3 -c anchor01 -t 30
ping -M do -s 8972 -c3 anchor01
```

✅ **Verify:** ≥ 900 Mbit/s, and the jumbo ping succeeds.
❌ If jumbo fails: the switch port may not be on the jumbo-enabled VLAN.

---

## Step 9 — Hand off to the other modules

Tell each owner, in this order — each has one thing to add:

| Person | What they add |
|--------|--------------|
| **Rahat** | `NodeName` in `slurm.conf`, restart `slurmctld`, `scontrol update NodeName=gpuNN State=RESUME` |
| **Tanvir** | Deploy the node agent |
| **Shanto** | Add NFS mounts to `/etc/fstab` |
| **Zafor** | Add Prometheus scrape targets |
| **Tanjimul** | Verify Apptainer + GPU access inside a container |

---

## Step 10 — Final verification

```bash
./scripts/netcheck.sh          # run ON the new node — everything green
./scripts/port-check.sh gpuNN  # 100% pass
sinfo -N -l | grep gpuNN       # Slurm shows it idle, not down
curl -s http://gpuNN:9100/metrics | head -3   # from anchor01
```

Then submit a small test job to that node specifically and confirm it completes.

---

## Step 11 — Close out

- [ ] Merge the PR from Step 1
- [ ] Update `inventory/cable-map.md` and the node status to `production`
- [ ] Post in the team channel: "gpuNN is live at 10.42.0.NN"

---

## If something goes wrong

| Stuck at | Go to |
|----------|-------|
| Link not 1000 Mb | [RB-04](RB-04-switch-or-link-failure.md) |
| Can't ping the node | [RB-02](RB-02-node-unreachable.md) |
| Reachable but slow | [RB-03](RB-03-slow-network-triage.md) |
| Anything else, twice | Message Abir with the exact command and its output |
