# ClusterOne networking — config as code (phases N0–N9)

Everything in the network plan (`abir-network-docs/`) that is software rather than cabling lives here. The inventory CSVs are the single source of truth; hosts files, netplan, DNS and Prometheus targets are generated from them.

```
inventory/    nodes.csv, interfaces.csv, cable-map.md     ← edit here first
netplan/      gen-netplan.sh + generated per-node YAML     (N2)
dns/          hosts.generate.sh, dnsmasq + resolved config (N2, N6)
chrony/       anchor = server, compute = client            (N2)
ssh/          sshd drop-ins, known_hosts, key rotation     (N3, N8)
firewall/     nftables (compute/anchor), egress, matrix    (N4, N8)  → POLICY.md
sysctl/ profile.d/ qos/   tuning, NCCL env, QoS            (N7)
rsyslog/ fail2ban/ containers/ nfs/   hardening, storage   (N7, N8)
monitoring/   Prometheus alerts, blackbox, target generator (N6)
scripts/      verification + benchmarks                    (N1, N5, N7, N9)
ansible/      deploys all of the above
switch/ reports/   switch config backups, benchmark output
```

## Workflow
1. Change `inventory/*.csv`.
2. `make generate` → commit the generated files.
3. `make check` (inventory rules, netplan drift) and `make lint`.
4. Deploy with Ansible one play at a time, `--check --diff` first: `cd ansible && ansible-playbook site.yml --tags common --check --diff`. Firewall last.

## Phase → files
| Phase | What | Where |
|---|---|---|
| N0 | inventory, IP-plan validation | `inventory/`, `scripts/inventory-validate.sh` |
| N1 | link, latency, MTU, iperf baseline | `scripts/{link-check,latency-matrix,mtu-matrix,iperf-matrix,collect-node-info}.sh` |
| N2 | netplan, DNS/DHCP, chrony | `netplan/`, `dns/`, `chrony/`, `scripts/netcheck.sh` |
| N3 | SSH trust | `ssh/` |
| N4 | firewall + NAT | `firewall/`, `scripts/port-check.sh` |
| N5 | firewall-on benchmarks, soak, recovery | `scripts/{bench-fw,soak,watch-recovery}.sh` |
| N6 | monitoring, name hygiene | `monitoring/`, `scripts/audit-hardcoded-ips.sh` |
| N7 | tuning, NCCL, DDP, NFS, QoS | `sysctl/`, `profile.d/`, `qos/`, `nfs/`, `scripts/{tuning-ab,nccl-bench,ddp-scaling,ddp-debug-checklist,app-transfer-test,nfs-check}.sh` |
| N8 | hardening, egress allowlist, audit logs | `firewall/egress-*`, `rsyslog/`, `fail2ban/`, `containers/`, `ssh/*hardening*`, `scripts/scan-verify.sh` |
| N9 | acceptance | `scripts/acceptance-test.sh` |

## Safety rules baked in
- Firewall and netplan changes are deployed with an automatic rollback (`apply-firewall.sh`, the Ansible firewall play, `netplan try`). Never a blind apply over SSH.
- Only the `clusterone` nft tables are touched; never `flush ruleset`, never `nft list ruleset > /etc/nftables.conf`.
- SSH hardening (`AllowGroups`) is opt-in (`enable_ssh_hardening`) because it can lock people out.
- Everything is bash-3.2 compatible so it runs on macOS dev machines as well as Ubuntu 22.04+.

## Known deviations from the phase docs (deliberate)
- **node↔node SSH stays open** (needed by torchrun/MPI); the doc's "only the anchor may SSH to compute" would break DDP.
- **port checks** classify *timeout = dropped, refused = passed the firewall*, so they work before services exist.
- **5201** is opened only temporarily (`bench-fw.sh`).
- **Egress:** no campus DNS/NTP in the forward allowlist (nodes use the anchor); allowlist by domain with an optional *dated* broad 80/443 rule.
- Agent port **9500** is a placeholder pending its owner (`tbc` in `port-matrix.tsv`).

## Not verified here
Written and linted on macOS (`bash -n`, shellcheck, yamllint, generators, inventory check all pass). **Not executed against real hardware:** nftables rulesets (`nft -c` unavailable locally), netplan on Ubuntu, dnsmasq, Ansible plays, the iperf/NCCL/DDP scripts, and Prometheus rules (`promtool` unavailable). First runs belong on one spare node with console access.
