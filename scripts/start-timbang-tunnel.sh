#!/usr/bin/env bash
# ==============================================================================
# QC MAESTRO - DEDICATED DOMAIN TUNNEL: https://timbang.tiraa.my.id (Linux)
# ==============================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

CONFIG="$ROOT/infrastructure/tunnel/timbang-tunnel.yml"
CRED="$ROOT/infrastructure/tunnel/a5d738a8-82b1-4304-a7ca-d208a308c5ef.json"

echo "================================================================"
echo "        QC MAESTRO - CLOUDFLARE PUBLIC DOMAIN TUNNEL           "
echo "================================================================"
echo " Domain Publik  : https://timbang.tiraa.my.id"
echo " Target Lokal   : http://127.0.0.1:4180 (Web Dashboard)"
echo " Tunnel ID      : a5d738a8-82b1-4304-a7ca-d208a308c5ef"
echo "----------------------------------------------------------------"
echo " Port Mapping:"
echo "   - Timbang (QC Maestro) : Port 4180 -> https://timbang.tiraa.my.id"
echo "   - Profesia (Laravel)   : Port 8000 -> https://profesia.tiraa.my.id"
echo "================================================================"

cloudflared tunnel --config "$CONFIG" --cred-file "$CRED" run a5d738a8-82b1-4304-a7ca-d208a308c5ef

