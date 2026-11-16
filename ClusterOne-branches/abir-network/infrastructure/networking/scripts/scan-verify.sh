#!/usr/bin/env bash
# scan-verify.sh — external port scan compared against the port matrix (N8/N9).
#
#   scan-verify.sh TARGET_IP [ALLOWED_TCP_PORTS_CSV]
#
# Run FROM CAMPUS (a laptop on the campus network, not the fabric) against the anchor's
# campus address. Fails if any TCP port other than the allowed list is open. Default allowed:
# 22,443,3000 (the anchor's campus-facing set in anchor.nft). Only scan hosts you own.
set -uo pipefail

[[ $# -ge 1 ]] || { echo "usage: $0 TARGET_IP [22,443,3000]" >&2; exit 2; }
command -v nmap >/dev/null || { echo "nmap not installed" >&2; exit 1; }
TARGET="$1"; ALLOWED="${2:-22,443,3000}"

open="$(nmap -Pn -p- --min-rate 2000 -oG - "$TARGET" \
  | awk '/Ports:/ { n=split($0,a,"Ports: "); m=split(a[2],p,", "); for(i=1;i<=m;i++){ split(p[i],f,"/"); if (f[2]=="open") print f[1] } }' \
  | sort -n | uniq)"
[[ -n "$open" || $? == 0 ]] || exit 1

unexpected=""
for p in $open; do
  case ",$ALLOWED," in *",$p,"*) ;; *) unexpected="$unexpected $p" ;; esac
done
echo "open TCP ports on $TARGET: ${open:-none}" | tr '\n' ' '; echo
if [[ -n "$unexpected" ]]; then echo "FAIL: unexpected open ports:$unexpected"; exit 1; fi
echo "PASS: only the allowed ports ($ALLOWED) are open"
