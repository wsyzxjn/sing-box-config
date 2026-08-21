# sing-box-config

OpenWrt 网关用的 sing-box 骨架，分组和规则对齐现有 Mihomo `override.yaml`。

sing-box 不认模板。GitHub 只放 **JSON 骨架 + 自定义规则**；Sub-Store 用脚本把组合订阅「Me」的节点填进去。

## 布局

```
template/openwrt.json   # TUN + auto_redirect、分组、规则（无节点）
scripts/merge.js        # Sub-Store 拼接脚本
scripts/update-openwrt.sh
rules/                  # 自己的规则集，远程热更新（1h）
  custom-direct.json    # → direct（已含 Tailscale DERP）
  custom-proxy.json     # → 其他
  custom-fullport.json  # → 全端口
```

公共 geosite/geoip 仍用 MetaCubeX `sing` 分支 `.srs`，24h 更新。自己的三条 `format: source`，改 JSON 推 GitHub 即可，不必改模板。

把仓库推到 `wsyzxjn/sing-box-config` 后，模板里的 raw 地址才能拉到规则。若仓库名或用户名不同，改 `template/openwrt.json` 里三处 `custom-*.json` 的 `url`。

## Sub-Store

1. 文件管理 → 新建 `SingBox`
2. 来源：远程  
   `https://raw.githubusercontent.com/wsyzxjn/sing-box-config/refs/heads/main/template/openwrt.json`
3. 脚本操作，链接：

```
https://raw.githubusercontent.com/wsyzxjn/sing-box-config/refs/heads/main/scripts/merge.js#type=1&name=Me
```

`type=1` 是组合订阅，`name=Me` 对应现有组合。预览应看到 `outbounds` 里出现机场节点，「香港」「全端口」不再为空。

## 路由

```sh
opkg install sing-box kmod-tun
# 或官方 apk：sing-box_*_openwrt_<arch>.apk
```

```sh
export SUB_STORE_URL='https://sub.tsukamao.me/<path>/download/SingBox'
sh update-openwrt.sh
```

定时刷新（节点，不是规则）：

```
0 * * * * SUB_STORE_URL='https://…/download/SingBox' /root/update-openwrt.sh
```

自定义规则靠 sing-box 自己的 `update_interval: 1h`，不用每次 wget 模板。

内核用官方 GitHub 的 OpenWrt ipk（ImmortalWrt 24.10 软件源锁在 1.12）。1.14+ 才有原生 API / 官方面板。

面板：

- 官方：`http://<路由>:9095/dashboard/`（sing-box-dashboard，1.14 API）
- Clash 兼容：`http://<路由>:9090/ui`（metacubexd）

`9090` / `9095` / `7890` 绑了 `0.0.0.0`，用防火墙限制只允许 LAN。

## DNS

LAN 继续走原来的嵌套，不让 sing-box 劫持 53：

```
客户端 → AdGuardHome :53 → mosdns :5335
```

1.14 模板里 tun 已设 `dns_mode: disabled`，不再劫持 LAN 53。1.12 的 `auto_redirect` 仍会给 `:53` 装 nft DNAT，那时要跑 `scripts/unhijack-dns.sh`。

## 热更新规则

编辑 `rules/custom-fullport.json` 例如：

```json
{
  "version": 3,
  "rules": [
    {
      "domain": ["matsuri.imoutofu.me"],
      "ip_cidr": ["99.225.216.87/32"]
    }
  ]
}
```

push 后最多约 1 小时（或重启 sing-box）生效。不要把机场节点写进这个仓库。
