# sb-panel

sing-box 原生 API 的可视化面板，补官方面板没有的内容：

- 概览 / ISBN（1.14 `StartedService` grpc-web）
- 代理组 / 连接 / 日志 / Clash Mode
- 规则 / 规则集（含规则内容、远端 URL、`download_detour`）
- DNS 规则 / 服务器
- 配置 JSON 直接编辑 + 保存（先 `sing-box check`）
- 重启内核、立即拉一下远端规则集

## 结构

```
web/      React + TS + Vite，官方 started_service.proto 生成 grpc-web 客户端
sidecar/  Go 伴生服务，承接到官方 API 之外的页面接口 + 静态服务
```

## 开发

```sh
cd web
pnpm install
pnpm gen       # proto -> src/gen/daemon/started_service_pb.ts
pnpm dev       # vite，5173
```

网关侧开发：

```sh
go build -o sb-panel-sidecar .
./sb-panel-sidecar
# 参数走环境变量，默认值：
# PANEL_LISTEN=0.0.0.0:9096
# PANEL_CONFIG=/etc/sing-box/config.json
# PANEL_CLASH=http://127.0.0.1:9090     # metacubexd 后端的 Clash API
# PANEL_API=http://127.0.0.1:9095       # 官方 StartedService grpc-web
# PANEL_UI 默认 ./dist，网关上是 /usr/share/sing-box/panel
```

没有任何后端 state，规则/秘密全靠 side-t拿到的 JSON。

## 做到哪

签原生 API `StartedService` 的所有方法（概览、组、连接、日志、Clash Mode、URL Test、SelectOutbound、Tailscale、STUN、网络质量、OpenVPN/Connect 状态）。管理 API（切换/重启/规则集刷新）在 sidecar，不抄 sing-box 内部的 daemon protobuf。

## 部署到 OpenWrt

```sh
# 先收集 dist
cd web && pnpm build
cd ..
# 加一份 linux/amd64 sidecar 到每页根目录
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o web/dist/sb-panel-sidecar ./sidecar
# 推送到路由
scp -r web/dist root@10.10.10.252:/tmp/panel-dist
```

路由上：

```sh
mkdir -p /usr/share/sing-box/panel
cp -R /tmp/panel-dist/* /usr/share/sing-box/panel/
chmod 755 /usr/share/sing-box/panel/sb-panel-sidecar
cat > /etc/init.d/sb-panel-sidecar <<'EOF'
#!/bin/sh /etc/rc.common
USE_PROCD=1
START=99
start_service() {
	procd_open_instance
	procd_set_param command /usr/share/sing-box/panel/sb-panel-sidecar
	procd_set_param respawn
	procd_set_param env PANEL_LISTEN=0.0.0.0:9096 PANEL_CONFIG=/etc/sing-box/config.json PANEL_CLASH=http://127.0.0.1:9090 PANEL_API=http://127.0.0.1:9095 PANEL_UI=/usr/share/sing-box/panel PANEL_SB=/usr/bin/sing-box
	procd_set_param stdout 1
	procd_set_param stderr 1
	procd_close_instance
}
EOF
chmod 755 /etc/init.d/sb-panel-sidecar
/etc/init.d/sb-panel-sidecar enable
/etc/init.d/sb-panel-sidecar start
```

入口：`http://<路由>:9096/`。设置页可改 `url`/`secret`（默认同源）。
