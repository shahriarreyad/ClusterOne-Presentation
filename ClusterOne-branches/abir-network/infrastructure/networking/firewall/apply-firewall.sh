#!/usr/bin/env bash
# apply-firewall.sh — safely deploy the ClusterOne nftables ruleset (N4.4 / N4.5).
#
#   sudo apply-firewall.sh compute|anchor [--egress open|allowlist] [--confirm-timeout SEC] [--dry-run]
#
# Safety net: a `policy drop` ruleset that forgot SSH locks you out of a headless box.
# So we (1) syntax-check, (2) snapshot our tables, (3) load, (4) arm a rollback timer,
# (5) require you to press ENTER within the timeout — from a NEW ssh session ideally.
# No ENTER = the previous ruleset is restored automatically.
#
# Only the `clusterone` tables are ever touched (never `flush ruleset`), so fail2ban's
# and Docker's tables are preserved. Persistence is the installed /etc/nftables.conf,
# never `nft list ruleset >` (which would also persist those foreign tables).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLE="${1:-}"; [[ $# -gt 0 ]] && shift
EGRESS="open"
TIMEOUT=60
DRY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --egress) EGRESS="$2"; shift 2 ;;
    --confirm-timeout) TIMEOUT="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
case "$ROLE" in compute|anchor) ;; *) echo "usage: $0 compute|anchor [--egress open|allowlist] [--confirm-timeout N] [--dry-run]" >&2; exit 2 ;; esac
case "$EGRESS" in open|allowlist) ;; *) echo "--egress must be open|allowlist" >&2; exit 2 ;; esac

command -v nft >/dev/null || { echo "nft not installed (apt install nftables)" >&2; exit 1; }
[[ $EUID -eq 0 || $DRY -eq 1 ]] || { echo "run as root" >&2; exit 1; }

RULES="$HERE/$ROLE.nft"
[[ -r "$RULES" ]] || { echo "missing $RULES" >&2; exit 1; }

EGRESS_DST="/etc/nftables.d/clusterone-egress.nft"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT

# anchor.nft includes an absolute path; stage the egress file first so the check sees it.
if [[ "$ROLE" == anchor ]]; then
  if [[ "$EGRESS" == open ]]; then
    cp "$HERE/egress-open.nft" "$STAGE/egress.nft"
  else
    "$HERE/egress-allowlist.sh" --out "$STAGE/egress.nft" --no-load \
      ${EGRESS_TEMP_WEB_UNTIL:+--temp-web-until "$EGRESS_TEMP_WEB_UNTIL"}
  fi
fi

echo "==> syntax check"
if [[ "$ROLE" == anchor ]]; then
  # check with the include pointing at the staged file
  sed "s#/etc/nftables.d/clusterone-egress.nft#$STAGE/egress.nft#" "$RULES" > "$STAGE/check.nft"
  nft -c -f "$STAGE/check.nft"
else
  nft -c -f "$RULES"
fi
echo "ok"
(( DRY )) && { echo "dry-run: nothing installed"; exit 0; }

SNAP="/var/backups/clusterone-nft-$(date +%Y%m%d-%H%M%S).nft"
install -d -m 0750 /var/backups
{
  nft list table inet clusterone 2>/dev/null || true
  nft list table ip clusterone_nat 2>/dev/null || true
} > "$SNAP"
echo "==> snapshot: $SNAP"

# rollback = delete our tables, then restore the snapshot (empty snapshot = no tables = open)
rollback() {
  echo "!! ROLLBACK" >&2
  nft delete table inet clusterone 2>/dev/null || true
  nft delete table ip clusterone_nat 2>/dev/null || true
  [[ -s "$SNAP" ]] && nft -f "$SNAP" || true
}

if [[ "$ROLE" == anchor ]]; then install -D -m 0644 "$STAGE/egress.nft" "$EGRESS_DST"; fi
echo "==> loading $ROLE ruleset"
nft -f "$RULES"

echo "==> Verify from ANOTHER terminal: ssh to this host, ping the anchor, resolve a name."
echo "    Press ENTER within ${TIMEOUT}s to keep the ruleset, or do nothing to roll back."
if read -r -t "$TIMEOUT" _; then
  install -m 0644 "$RULES" /etc/nftables.conf
  systemctl enable nftables >/dev/null 2>&1 || true
  echo "==> kept and persisted to /etc/nftables.conf"
else
  rollback
  exit 3
fi
