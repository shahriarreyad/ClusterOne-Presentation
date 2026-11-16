#!/usr/bin/env bash
# rotate-orchestration-key.sh — rotate the anchor→nodes automation key (N3/N8).
#
#   rotate-orchestration-key.sh [-u USER] [-k KEYFILE] [nodes.csv]
#
# Order matters so you never lock automation out:
#   1. generate the new key  2. ADD it on every node  3. prove it works
#   4. only then REMOVE the old public key from every node.
# The old private key is kept as KEYFILE.old until you delete it.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUSER="${USER:-root}"; KEY="$HOME/.ssh/id_orchestration"
while getopts "u:k:" o; do case $o in u) RUSER="$OPTARG";; k) KEY="$OPTARG";; *) exit 2;; esac; done
shift $((OPTIND-1))
CSV="${1:-$HERE/../inventory/nodes.csv}"

[[ -f "$KEY" ]] || { echo "no existing key at $KEY (nothing to rotate)" >&2; exit 1; }
old_pub="$(awk '{print $2}' "$KEY.pub")"

mv "$KEY" "$KEY.old"; mv "$KEY.pub" "$KEY.old.pub"
ssh-keygen -q -t ed25519 -N "" -C "orchestration@clusterone $(date +%F)" -f "$KEY"
new_pub="$(cat "$KEY.pub")"

nodes=()
while IFS=, read -r name ip _r; do
  [[ -z "$name" || "$name" == \#* || "$name" == shortname ]] && continue
  nodes+=("$ip")
done < "$CSV"

SSH_OLD=(ssh -i "$KEY.old" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5)
for ip in "${nodes[@]}"; do
  "${SSH_OLD[@]}" "$RUSER@$ip" "grep -qF '$new_pub' ~/.ssh/authorized_keys || echo '$new_pub' >> ~/.ssh/authorized_keys"
done
echo "new key added on ${#nodes[@]} nodes; verifying"

for ip in "${nodes[@]}"; do
  ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=5 "$RUSER@$ip" true \
    || { echo "!! new key FAILED on $ip — old key left in place, aborting" >&2; exit 1; }
done

for ip in "${nodes[@]}"; do
  ssh -i "$KEY" -o IdentitiesOnly=yes "$RUSER@$ip" "grep -vF '$old_pub' ~/.ssh/authorized_keys > ~/.ssh/ak.new && cat ~/.ssh/ak.new > ~/.ssh/authorized_keys && rm ~/.ssh/ak.new"
done
echo "rotated. Old private key: $KEY.old (delete when satisfied)."
