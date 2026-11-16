# Phase N3 — SSH & Access Layer

> **Goal:** Passwordless, key-only SSH in every direction the cluster needs —
> anchor→node, node→node, and admin→cluster — with passwords disabled everywhere.

| | |
|---|---|
| **Duration** | 3–4 days (week 2–3) |
| **Entry condition** | N2 signed off — names resolve, IPs are stable |
| **Blocks** | 🏁 **Milestone 1.** Slurm launch, MPI, the DDP launcher, Ansible, `pdsh` |
| **Blocked by** | Nothing |

---

## Why this phase exists

Three separate consumers need SSH, and they need it in different directions:

```text
   Admin (me, Rahat)  ──────►  anchor01        (jump host, key from my laptop)
   anchor01           ──────►  gpuNN           (Ansible, Slurm ops, orchestration)
   gpuNN              ──────►  gpuMM           (MPI / PyTorch DDP launcher, node↔node)
```

That third one is the one people forget. **`torchrun` and MPI need node→node SSH.**
If it isn't set up in N3, Sadik Fahim's distributed training fails in N7 with an opaque
error, and it takes a day to trace back here.

---

## Tasks

### N3.1 — Baseline `sshd_config` on every node

`infrastructure/networking/ssh/sshd_config.d/10-clusterone.conf`:

```conf
# --- ClusterOne SSH baseline ---
Port 22
Protocol 2

# keys only
PubkeyAuthentication yes
PasswordAuthentication no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no

# root: no interactive login; only forced commands if ever needed
PermitRootLogin prohibit-password

# strong algorithms only
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# hygiene
LoginGraceTime 30
MaxAuthTries 4
X11Forwarding no
AllowAgentForwarding yes      # needed for the anchor-as-jump-host pattern
ClientAliveInterval 60
ClientAliveCountMax 3

# audit
LogLevel VERBOSE              # logs the key fingerprint used for each login
```

> **Order of operations matters.** Deploy keys FIRST (N3.2), verify key login works,
> and only THEN set `PasswordAuthentication no`. Doing it the other way round locks the
> whole cluster out and needs physical console access to fix.

Apply:
```bash
sudo sshd -t                      # validate config BEFORE restarting
sudo systemctl reload ssh
```

### N3.2 — Key strategy

Three key types, three purposes:

| Key | Lives on | Authorises on | Purpose |
|-----|----------|---------------|---------|
| **Admin key** (per person, ed25519 + passphrase) | my laptop | `anchor01` | human login |
| **Cluster orchestration key** | `anchor01` (root/`clusterone` user, `0600`) | all `gpuNN` | Ansible, ops, Slurm admin |
| **Node↔node trust** | all nodes | all nodes | MPI / DDP launcher |

```bash
# admin key, on my laptop
ssh-keygen -t ed25519 -C "abir@clusterone-admin" -f ~/.ssh/clusterone_admin

# orchestration key, on anchor01, no passphrase (it's used non-interactively)
sudo -u clusterone ssh-keygen -t ed25519 -N '' \
     -C "clusterone-orchestration" -f ~clusterone/.ssh/id_ed25519
```

Never commit a private key. `.gitignore` must contain `id_*`, `*.pem`, `*_key`.
Public keys are fine in git and belong in `infrastructure/networking/ssh/authorized/`.

### N3.3 — Node↔node passwordless trust (the DDP prerequisite)

Two acceptable approaches. Pick **A** for the pilot.

**A. Shared cluster user + shared key over NFS `/home`** ✅

Once Shanto's NFS `/home` is mounted, each user's `~/.ssh/` is automatically the same on
every node, so `authorized_keys` is shared by construction:

```bash
ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
```

That single step gives every user node→node access on every node. Elegant, and it's the
standard HPC pattern.

**B. Host-based authentication** — machine-level trust via `/etc/ssh/shosts.equiv` and
`ssh_known_hosts`. More correct for a real HPC site, more setup. Note it as the N8/N9
hardening upgrade path, not pilot work.

### N3.4 — Distribute host keys (kill the fingerprint prompt)

An interactive `Are you sure you want to continue connecting?` prompt breaks every
automated launcher. Pre-seed a **global** known_hosts file:

```bash
# on anchor01
ssh-keyscan -t ed25519 -H anchor01 gpu01 gpu02 gpu03 gpu04 gpu05 \
  10.42.0.10 10.42.0.21 10.42.0.22 10.42.0.23 10.42.0.24 10.42.0.25 \
  > /etc/ssh/ssh_known_hosts
```

Push that file to every node with Ansible. Scan both names and IPs — a launcher may use
either.

Do **not** solve this with `StrictHostKeyChecking no`. That disables the protection
instead of satisfying it. Pre-seeding is the correct fix.

### N3.5 — Client convenience config

`~/.ssh/config` on the anchor and on my laptop:

```sshconfig
Host anchor01 anchor
    HostName anchor01.clusterone.internal
    User abir
    IdentityFile ~/.ssh/clusterone_admin

# reach compute nodes from outside via the anchor
Host gpu*
    User clusterone
    ProxyJump anchor01
    IdentityFile ~/.ssh/clusterone_admin

Host *
    ServerAliveInterval 60
    ControlMaster auto
    ControlPath ~/.ssh/cm-%r@%h:%p
    ControlPersist 10m
```

`ControlMaster` reuses one TCP connection for repeated commands — a noticeable speed-up
for Ansible and for loops over nodes.

### N3.6 — Install a parallel shell

```bash
sudo apt install -y pdsh
echo "gpu[01-05]" | sudo tee /etc/pdsh/machines
export PDSH_RCMD_TYPE=ssh
```

This turns "check something on all nodes" from a 5-minute chore into one line — and it's
the command that verifies this phase.

### N3.7 — Verify

```bash
# 1. anchor → every node, no prompt, no password
pdsh -w gpu[01-05] hostname

# 2. node → node (the DDP path)
ssh gpu01 'ssh gpu02 hostname'

# 3. passwords really are disabled
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no gpu01
#    expected: "Permission denied (publickey)"

# 4. no fingerprint prompt from a clean state
ssh -o StrictHostKeyChecking=yes gpu03 hostname

# 5. sshd config is valid on every node
pdsh -w gpu[01-05] 'sudo sshd -t && echo config-ok'
```

Every one of these must pass with **zero interactive prompts**. That is the whole point
of the phase.

---

## Deliverables

- [ ] `infrastructure/networking/ssh/sshd_config.d/10-clusterone.conf`
- [ ] Ansible playbook: key distribution + known_hosts push + sshd reload
- [ ] `/etc/ssh/ssh_known_hosts` generated and deployed
- [ ] `reference/ssh-standard.md` — finalised, handed to Rahat and Sadik Fahim
- [ ] `reports/N3-ssh.md` — output of all five verification commands
- [ ] `.gitignore` updated so private keys can never be committed

---

## Exit gate 🏁 (also **Milestone 1**)

> **`pdsh -w gpu[01-05] hostname` returns every node with no prompts;
> `ssh gpu01 'ssh gpu02 hostname'` works; password auth is refused cluster-wide.**

At this point Tanvir can deploy the agent, Rahat can address nodes, and I announce
Milestone 1 to the team.

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Still asks for a password | Wrong perms on `~/.ssh` (must be 700) or `authorized_keys` (600), or `/home` is 777 | `chmod` — sshd silently ignores group/world-writable dirs. Check `journalctl -u ssh`. |
| Works as me, fails from Slurm | Slurm runs as a different user without that key | Use the shared-`/home` pattern (N3.3-A) |
| Fingerprint prompt in `torchrun` | `ssh_known_hosts` missing the name form the launcher used | Re-scan with **both** short names and IPs |
| Locked out after `PasswordAuthentication no` | Keys weren't verified first | Physical console; order in N3.1 exists to prevent this |
| `ssh gpu01` works, `ssh gpu01.clusterone.internal` doesn't | known_hosts / DNS mismatch | Scan the FQDN too; check the `search` domain from N2 |
| node→node works for me but not other users | Per-user keys, no shared `/home` yet | Blocked on Shanto's NFS — note it and re-verify after N6 |
