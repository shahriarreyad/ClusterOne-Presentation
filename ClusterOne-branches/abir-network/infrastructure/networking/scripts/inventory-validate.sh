#!/usr/bin/env bash
# inventory-validate.sh — sanity-check inventory/*.csv and cross-check the docs (N0/N1).
#
#   inventory-validate.sh
#
# Checks: CSV shape, valid + unique IPs, all inside 10.42.0.0/24, the gpuNN = .(20+NN) rule,
# anchor = .10, every node has an interfaces.csv row, MAC format, and that each node's IP
# appears in abir-network-docs/reference/ip-address-plan.md. Exit 1 on any error.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$HERE/lib.sh"

IFACES="$NET_ROOT/inventory/interfaces.csv"
PLAN="$NET_ROOT/../../abir-network-docs/reference/ip-address-plan.md"
errs=0; e() { echo "ERR  $*"; errs=$((errs+1)); }

octet_ok() { [[ "$1" =~ ^[0-9]+$ ]] && (( $1 >= 0 && $1 <= 255 )); }
valid_ip() {
  local IFS=.; local -a o; read -r -a o <<< "$1"
  [[ ${#o[@]} -eq 4 ]] || return 1
  local x; for x in "${o[@]}"; do octet_ok "$x" || return 1; done
}

seen_ips=" "; seen_names=" "
while read -r name ip; do
  role="$(awk -F, -v n="$name" '$1==n {print $3}' "$NODES_CSV")"
  valid_ip "$ip" || { e "$name: invalid IP '$ip'"; continue; }
  [[ "$ip" == 10.42.0.* ]] || e "$name: $ip outside 10.42.0.0/24"
  [[ "$seen_ips"   == *" $ip "*   ]] && e "duplicate IP $ip"
  [[ "$seen_names" == *" $name "* ]] && e "duplicate name $name"
  seen_ips="$seen_ips$ip "; seen_names="$seen_names$name "

  last="${ip##*.}"
  case "$role" in
    controller) [[ "$last" == 10 ]] || e "$name: controller must be .10, is .$last" ;;
    compute)
      if [[ "$name" =~ ^gpu([0-9]{2})$ ]]; then
        want=$(( 20 + 10#${BASH_REMATCH[1]} ))
        [[ "$last" == "$want" ]] || e "$name: expected .$want (20+NN), is .$last"
      else e "$name: compute names must be gpuNN"; fi ;;
    *) e "$name: unknown role '$role'" ;;
  esac
  (( last >= 200 && last <= 250 )) && e "$name: .$last is inside the DHCP staging pool .200-.250"

  [[ -r "$IFACES" ]] && ! grep -q "^$name," "$IFACES" && e "$name: no row in interfaces.csv"
  [[ -r "$PLAN" ]] && ! grep -q "$ip" "$PLAN" && e "$name: $ip not found in ip-address-plan.md"
done < <(nodes_list)

if [[ -r "$IFACES" ]]; then
  while IFS=, read -r n _f _c mac; do
    [[ -z "$n" || "$n" == \#* || "$n" == shortname ]] && continue
    [[ -z "$mac" || "$mac" =~ ^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$ ]] || e "$n: bad MAC '$mac'"
  done < "$IFACES"
fi

[[ $errs -eq 0 ]] && echo "inventory OK ($(nodes_list | wc -l | tr -d ' ') nodes)"
exit $(( errs > 0 ))
