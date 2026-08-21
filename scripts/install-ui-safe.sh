#!/bin/sh
# Safe side-install on OpenWrt/ImmortalWrt:
# - does not stop OpenClash / Passwall / HomeProxy / Nikki
# - does not enable tun / auto_redirect
# - does not change fw4 or default route
# Dashboard: http://<router>:19090

set -eu

UI_PORT="${UI_PORT:-19090}"
MIXED_PORT="${MIXED_PORT:-17890}"
DEST_DIR="${DEST_DIR:-/etc/sing-box}"
UI_DIR="$DEST_DIR/ui"
CONF="$DEST_DIR/config.ui-test.json"

echo "==> current proxy-related services (left running)"
for s in openclash homeproxy passwall passwall2 nikki mihomo shadowsocksr; do
  if [ -x "/etc/init.d/$s" ]; then
    echo "    $s: $(/etc/init.d/$s enabled && echo enabled || echo present)"
  fi
done

echo "==> install sing-box if missing"
if ! command -v sing-box >/dev/null 2>&1; then
  if command -v apk >/dev/null 2>&1; then
    apk add sing-box || apk add --allow-untrusted sing-box
  else
    opkg update
    opkg install sing-box
  fi
fi
sing-box version | head -1

mkdir -p "$DEST_DIR" "$UI_DIR"

echo "==> fetch metacubexd (dashboard only)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
wget -qO "$TMP/ui.zip" \
  "https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip" \
  || wget -qO "$TMP/ui.zip" \
  "https://ghfast.top/https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip"
unzip -qo "$TMP/ui.zip" -d "$TMP"
rm -rf "$UI_DIR"
mkdir -p "$UI_DIR"
cp -R "$TMP"/metacubexd-gh-pages/. "$UI_DIR"/

echo "==> write test config (mixed + clash_api only, NO tun)"
cat > "$CONF" <<EOF
{
  "log": { "level": "info", "timestamp": true },
  "inbounds": [
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "0.0.0.0",
      "listen_port": $MIXED_PORT
    }
  ],
  "outbounds": [
    { "tag": "direct", "type": "direct" }
  ],
  "route": { "final": "direct" },
  "experimental": {
    "clash_api": {
      "external_controller": "0.0.0.0:$UI_PORT",
      "external_ui": "$UI_DIR",
      "secret": ""
    }
  }
}
EOF
sing-box check -c "$CONF"

echo
echo "Installed. Current gateway proxy was NOT switched."
echo "Optional smoke test (still no TUN):"
echo "  sing-box run -c $CONF"
echo "Then open: http://<router-ip>:$UI_PORT"
echo "Ctrl-C stops only this test process."
echo
echo "Do NOT 'service sing-box enable' until you are ready to replace the old proxy."
echo "Do NOT use template/openwrt.json yet — that file has auto_redirect and would take over LAN."
