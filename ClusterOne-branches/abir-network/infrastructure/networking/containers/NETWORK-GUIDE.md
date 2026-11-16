# Containers and the cluster network (N8)

## Rule of thumb
Training containers run with **`--network host`**. NCCL and torchrun need the fabric interface and its jumbo MTU; a Docker bridge adds NAT, a 1500 MTU and a firewall that nftables does not manage.

```bash
docker run --rm --gpus all --network host --ipc host <image> torchrun ...
```

## Why `docker-daemon.json` sets `iptables: false`
By default Docker inserts its own iptables/nft rules, including `FORWARD ACCEPT` for bridge networks and published ports that **bypass `input policy drop`**. With `iptables: false`, Docker touches no firewall rules, so `compute.nft` stays the single authority. Consequences:
- Published ports (`-p 8080:80`) do **not** work on bridge networks. Use host networking, or add an explicit rule to `compute.nft` and the port matrix.
- Bridge containers have no NAT egress. That is intended: egress goes through the anchor policy (N8).

Install: `/etc/docker/daemon.json`, then `systemctl restart docker`. Do this **before** the first container run; if Docker already created rules, restart the node's firewall (`systemctl restart nftables`) after removing Docker's chains.

## Checklist for a new container workload
- [ ] `--network host` (or a documented reason not to)
- [ ] uses `NCCL_SOCKET_IFNAME` from `/etc/profile.d/clusterone-nccl.sh` (pass with `-e` or `--env-file`)
- [ ] any new listening port is in `port-matrix.md` and `compute.nft`
- [ ] image pulls come from allowlisted domains (`firewall/egress-domains.txt`) — or pre-pull on the anchor
