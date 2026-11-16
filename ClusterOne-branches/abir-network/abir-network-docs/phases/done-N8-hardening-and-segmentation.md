# Phase N8 — Hardening & Segmentation

> **Goal:** Turn a working network into a defensible one — least privilege on the wire,
> a controlled egress door, and an audit trail.

| | |
|---|---|
| **Duration** | 4–6 days (week 10–11) |
| **Entry condition** | N7 signed off; all services deployed and known-good |
| **Blocks** | N9, production sign-off |
| **Blocked by** | A managed switch for real VLANs (R1); Irfanur's auth model for user-facing rules |

---

## Why this phase exists

The project plan lists security as a phase in its own right and says explicitly it
cannot be an afterthought. My slice is the network layer: **isolated compute network,
restricted SSH, controlled internet access, audit logs.**

The ordering is deliberate — hardening comes *after* everything works, so when something
breaks here I know the firewall did it. Hardening a system that was never working just
produces two unknowns at once.

---

## Tasks

### N8.1 — VLAN segmentation (managed switch)

| VLAN | Name | Members | Can reach |
|------|------|---------|-----------|
| 42 | `net-cluster` | anchor `eno2`, all `gpuNN` | itself + anchor services |
| 43 | `net-fast` | reserved | (future NCCL only) |
| 9 | `net-oob` | switch mgmt, BMC | **anchor only** |
| — | campus | anchor `eno1` | outbound + inbound 443/22 only |

Rules on the switch:
- Compute ports are **access ports** on VLAN 42, untagged. No trunking to a node.
- The management VLAN is reachable only from the anchor, never from a compute node —
  a compromised student job must not be able to reconfigure the switch.
- Disable unused ports outright.
- Enable port security / MAC limiting if supported (one MAC per compute port).

**If the switch is unmanaged (R1 realised):** record it explicitly. Segmentation then
rests entirely on the host firewall from N4. Say so in the report — a documented gap is
acceptable; an undocumented one is not.

### N8.2 — Tighten egress from NAT to an allowlist

N4 gave compute nodes broad NAT egress. Narrow it:

```nft
table inet clusterone_egress {
  set allowed_dst {
    type ipv4_addr; flags interval;
    elements = {
      <campus-dns>, <campus-ntp>,
      <apt-mirror>, <pypi-cdn>, <hf-cdn>      # resolve and pin, or use a proxy
    }
  }

  chain forward {
    type filter hook forward priority filter; policy drop;
    ct state established,related accept
    ip saddr 10.42.0.0/24 ip daddr @allowed_dst accept
    ip saddr 10.42.0.0/24 tcp dport { 80, 443 } accept comment "TEMP: review in N9"
    limit rate 10/minute log prefix "egress-drop: " level info
  }
}
```

CDN-backed services (PyPI, HuggingFace) rotate IPs, so a pure IP allowlist is brittle.
The clean answer is an **HTTP proxy on the anchor with a domain allowlist**; note it as
the recommended N9+ improvement and keep the temporary 80/443 rule visible and dated
rather than quietly permanent.

### N8.3 — SSH hardening pass two

Beyond N3's baseline:

```conf
# restrict who can log in at all
AllowGroups clusterone-users clusterone-admins

# compute nodes: only the anchor may SSH in
Match Address 10.42.0.10
    PermitRootLogin prohibit-password
Match Address *,!10.42.0.0/24
    DenyUsers *

# rate-limit brute force at the network layer too (nftables)
#   tcp dport 22 ct state new limit rate 10/minute accept
```

Also:
- [ ] Install `fail2ban` on the anchor (the only campus-exposed SSH surface)
- [ ] Rotate the orchestration key; document the rotation procedure
- [ ] Audit `authorized_keys` on every node — remove keys of anyone who has left
- [ ] Confirm `LogLevel VERBOSE` is on, so key fingerprints appear in logs

### N8.4 — Audit logging

```bash
# ship firewall drops and ssh auth to a central place on the anchor
# /etc/rsyslog.d/50-clusterone.conf on compute nodes:
#   auth,authpriv.*   @@10.42.0.10:514
#   :msg,contains,"nft-drop-in"  @@10.42.0.10:514
```

Log, at minimum:
- every SSH login: user, source IP, key fingerprint, timestamp
- every firewall drop (rate-limited)
- every sudo invocation
- switch config changes (if the switch supports syslog export)

Retention: 90 days minimum. Coordinate with Zafor — Loki or plain rsyslog files both
work; what matters is that logs leave the node they were generated on.

### N8.5 — Verification scan

From **outside** the cluster (my laptop on campus):

```bash
# what does the anchor actually expose to campus?
nmap -sS -p- -T4 <anchor-campus-ip>
# expected: 22, 443, 3000 — and nothing else

# can campus reach a compute node at all? (it must not)
nmap -sn 10.42.0.0/24            # expected: no route / nothing found
```

From **inside** a compute node:

```bash
# can a node reach the switch management? (it must not)
nc -z -w2 10.42.9.1 80 && echo "FAIL: node can reach switch mgmt"

# can a node reach the campus network directly? (only via NAT, not laterally)
nmap -sn <campus-subnet>         # expected: blocked
```

Every unexpected open port gets closed or explicitly justified in writing. No exceptions.

### N8.6 — Container network policy

Advise Tanjimul, and enforce at the host:

- Apptainer containers use the **host network** by default — they inherit host firewall
  rules. Good.
- `--net --network=none` for jobs that need no network at all (many training jobs, once
  data is staged locally).
- Never run containers with `--net` bridged in a way that bypasses `nftables`.
- If Docker is ever installed on a compute node, it **will** insert its own iptables
  rules and can silently punch holes in the firewall. Either don't install it, or set
  `"iptables": false` in `daemon.json` and manage the rules myself.

### N8.7 — Document the policy

`infrastructure/networking/firewall/POLICY.md`:

1. The trust model, in one paragraph — who trusts whom, and why
2. The full allowlist with a justification per rule
3. The exception process: who can request a port, who approves, where it's recorded
4. The review cadence (every release)
5. Known accepted gaps (e.g. unmanaged switch, the temporary 80/443 egress rule)

---

## Deliverables

- [ ] VLAN configuration applied + switch config backed up
- [ ] Egress allowlist deployed (or the proxy recommendation written up)
- [ ] SSH hardening pass two applied cluster-wide
- [ ] Central audit logging working, verified by finding a test login in the anchor's log
- [ ] `reports/N8-hardening.md` with full internal + external scan output
- [ ] `firewall/POLICY.md`
- [ ] Container network guidance sent to Tanjimul

---

## Exit gate

> **An external `nmap` of the anchor shows only 22/443/3000; compute nodes are
> unreachable from campus; a node cannot reach the switch management VLAN; SSH logins
> and firewall drops appear in the central log.**

Paste the actual scan output into the report — this is the artifact a security review
will ask for.

---

## Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Everything breaks after hardening | Too many changes at once | Apply one change, verify, commit. Never batch a hardening pass. |
| `pip install` stops working on nodes | Egress allowlist too tight (CDN IPs rotated) | Proxy with a domain allowlist; don't chase IPs |
| Docker silently reopened ports | Docker rewrites iptables on start | `"iptables": false` or don't install Docker on compute nodes |
| Locked out after `AllowGroups` | My account wasn't in the group | Verify group membership on every node **before** reloading sshd |
| Central logs empty | rsyslog forwarding not enabled, or 514 blocked | Check the N4 matrix includes 514 from fabric → anchor |
| Slurm breaks after VLAN change | Node ports landed on the wrong VLAN | Verify per-port VLAN assignment against the cable map |
