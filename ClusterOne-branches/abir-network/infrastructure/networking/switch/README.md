# Switch (SW01) configuration

The switch is the one part of the network that is configured by hand, so its config is treated as a backup artefact, not code.

- **Export the running config after every change** into `backups/` as `sw01-YYYYMMDD-<what-changed>.cfg`.
- Never commit a config containing passwords, SNMP communities, or keys — strip or `git-crypt` them first. `backups/` holds only sanitised files.
- Settings the rest of the repo assumes: VLAN 42 (fabric, MTU 9000 on every port and the switch global), management reachable only from the anchor, unused ports shut, `sw-blk` in `firewall/port-matrix.tsv` (nodes cannot reach the management interface).
- Physical port map: `../inventory/cable-map.md`.
