# Custom rule-sets

These are sing-box **source** rule-sets. The OpenWrt template loads them as
`type: remote` / `format: source` with `update_interval: 1h`, so a git push is
enough for the router to pick up changes on the next refresh. No template edit
needed for adding a domain.

| File | Routed to | Use for |
| --- | --- | --- |
| `custom-direct.json` | `direct` | Always bypass proxy (Tailscale DERP, LAN extras) |
| `custom-proxy.json` | `其他` | Extra foreign domains |
| `custom-fullport.json` | `全端口` | Destinations that need nodes without dest-port filters |

Replace `example.invalid` with real hosts. Empty `domain` arrays may fail to
parse; keep a dummy or a real name.

Headless rule fields: `domain`, `domain_suffix`, `domain_keyword`,
`domain_regex`, `ip_cidr`. See [source format](https://sing-box.sagernet.org/configuration/rule-set/source-format/).

Optional: compile to binary for less memory on the router:

```bash
sing-box rule-set compile --output custom-direct.srs custom-direct.json
```

Then switch the template `format` to `binary` and point `url` at the `.srs`.
