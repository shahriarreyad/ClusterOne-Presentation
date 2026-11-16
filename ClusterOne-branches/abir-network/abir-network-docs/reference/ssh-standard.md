# Reference — SSH Standard

> ⚠️ **Contract file.** Slurm, Ansible, `pdsh`, MPI and the PyTorch DDP launcher all
> depend on this behaving exactly as described.

---

## 1. The three access paths

```text
  ┌──────────┐   admin key, ProxyJump    ┌──────────┐
  │ my laptop│ ─────────────────────────►│ anchor01 │
  └──────────┘                            └────┬─────┘
                                               │ orchestration key
                                               ▼
                                          ┌──────────┐
                                          │  gpuNN   │
                                          └────┬─────┘
                                               │ node↔node trust
                                               ▼   (MPI / torchrun)
                                          ┌──────────┐
                                          │  gpuMM   │
                                          └──────────┘
```

| Path | Key | Enabled in | Consumers |
|------|-----|-----------|-----------|
| laptop → anchor01 | per-person admin key (passphrase-protected) | N3.2 | humans |
| anchor01 → gpuNN | orchestration key (no passphrase) | N3.2 | Ansible, `pdsh`, ops |
| gpuNN → gpuMM | shared user key over NFS `/home` | N3.3 | **MPI, torchrun, DDP** |

The third path is the one that silently breaks distributed training if it's missing.

---

## 2. Key policy

| Rule | Value |
|------|-------|
| Algorithm | `ed25519` only (no RSA, no DSA, no ECDSA) |
| Admin keys | Must have a passphrase |
| Orchestration key | No passphrase (it's used non-interactively), `0600`, on the anchor only |
| Private keys in git | **Never.** `.gitignore`: `id_*`, `*.pem`, `*_key`, `!*.pub` |
| Public keys in git | Yes — `infrastructure/networking/ssh/authorized/` |
| Rotation | Orchestration key every semester, or immediately when someone leaves |
| Offboarding | Remove the person's key from every `authorized_keys` the same day |

```bash
ssh-keygen -t ed25519 -C "<name>@clusterone" -f ~/.ssh/clusterone_<purpose>
```

---

## 3. Server config (`/etc/ssh/sshd_config.d/10-clusterone.conf`)

```conf
PubkeyAuthentication yes
PasswordAuthentication no
PermitEmptyPasswords no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password

KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

LoginGraceTime 30
MaxAuthTries 4
X11Forwarding no
AllowAgentForwarding yes
ClientAliveInterval 60
ClientAliveCountMax 3
LogLevel VERBOSE

# N8 adds:
# AllowGroups clusterone-users clusterone-admins
```

**Deployment order is not optional:**

```text
1. Deploy public keys
2. Verify key login works from every direction
3. THEN set PasswordAuthentication no
4. sshd -t   (validate)
5. systemctl reload ssh   (reload, not restart — existing sessions survive)
```

Doing 3 before 2 locks out the cluster and requires physical console access.

---

## 4. Client config

`~/.ssh/config`:

```sshconfig
Host anchor01 anchor
    HostName anchor01.clusterone.internal
    User <me>
    IdentityFile ~/.ssh/clusterone_admin

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

---

## 5. Host keys — no prompts, ever

Automated launchers break on the fingerprint prompt. Pre-seed instead of disabling:

```bash
ssh-keyscan -t ed25519 -H \
  anchor01 gpu01 gpu02 gpu03 gpu04 gpu05 \
  10.42.0.10 10.42.0.21 10.42.0.22 10.42.0.23 10.42.0.24 10.42.0.25 \
  > /etc/ssh/ssh_known_hosts
```

Scan **both** short names and IPs — a launcher may use either form. Regenerate after any
OS reinstall (the host key changes) and after any rename.

❌ Do not use `StrictHostKeyChecking no`. It removes the protection instead of satisfying
the requirement, and it hides genuine MITM/host-key-changed warnings.

---

## 6. Required permissions (the #1 cause of "still asks for a password")

| Path | Mode |
|------|------|
| `~` | `755` or stricter — **not** group/world writable |
| `~/.ssh` | `700` |
| `~/.ssh/authorized_keys` | `600` |
| `~/.ssh/id_ed25519` | `600` |
| `~/.ssh/id_ed25519.pub` | `644` |

sshd silently refuses keys in loosely-permissioned directories. The evidence is always in
`journalctl -u ssh` on the **server** — check there, not on the client.

---

## 7. For Sadik Fahim (DDP) and Rahat (Slurm)

What you can rely on:

- `ssh gpuNN` from any node, as any cluster user, with **no password and no prompt**
- Both `gpu01` and `gpu01.clusterone.internal` resolve and are in `ssh_known_hosts`
- Agent forwarding is available if you need it
- SSH multiplexing is on — repeated commands to the same host are fast

What you must **not** do:

- Do not add `StrictHostKeyChecking=no` to a launcher — tell me the host key is missing
  and I'll add it properly
- Do not create per-project keys — use the shared `/home` key
- Do not rely on password auth in any script; it does not exist here

---

## 8. Verification

```bash
pdsh -w gpu[01-05] hostname                     # anchor → all, no prompts
ssh gpu01 'ssh gpu02 hostname'                  # node → node
ssh -o PreferredAuthentications=password \
    -o PubkeyAuthentication=no gpu01            # must be denied
ssh -o StrictHostKeyChecking=yes gpu03 hostname # no fingerprint prompt
pdsh -w gpu[01-05] 'sudo sshd -t && echo ok'    # config valid everywhere
```

All five must pass with zero interaction. That is the standard.
