#!/bin/sh
# sing-box 1.12 auto_redirect always DNATs LAN :53 into tun (172.19.0.2).
# LAN DNS is AdGuardHome :53 → mosdns :5335; drop those NAT rules after start.
# Official dns_mode=disabled exists only in 1.14+.

set -f

waited=0
while [ "$waited" -lt 20 ]; do
  if nft list table inet sing-box >/dev/null 2>&1; then
    handles=$(nft -a list table inet sing-box 2>/dev/null | awk '/th dport 53/ && /dnat/ {print $NF}')
    for h in $handles; do
      nft delete rule inet sing-box prerouting handle "$h" 2>/dev/null || true
      nft delete rule inet sing-box output handle "$h" 2>/dev/null || true
    done
    if ! nft list table inet sing-box 2>/dev/null | grep -q 'th dport 53'; then
      exit 0
    fi
  fi
  waited=$((waited + 1))
  sleep 1
done
exit 0
