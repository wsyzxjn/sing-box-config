#!/bin/sh
# Run on the router. SUB_STORE_URL must be the Sub-Store file download link
# (the generated JSON, not the GitHub template).

set -eu
URL="${SUB_STORE_URL:?set SUB_STORE_URL to the Sub-Store /download/SingBox URL}"
DEST="${DEST:-/etc/sing-box/config.json}"
TMP="$(mktemp)"

wget -qO "$TMP" "$URL"
sing-box check -c "$TMP"
mv "$TMP" "$DEST"
if command -v service >/dev/null 2>&1; then
  service sing-box reload || service sing-box restart
else
  /etc/init.d/sing-box reload || /etc/init.d/sing-box restart
fi
