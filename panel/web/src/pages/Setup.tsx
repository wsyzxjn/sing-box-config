import { useState } from "react";
import { defaultServer, loadServer, saveServer } from "../lib/api";

export function SetupPage() {
  const [cfg, setCfg] = useState(loadServer());
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <h1>设置</h1>
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="stat-label">后端地址</div>
        <input
          type="text"
          style={{ width: "100%", marginTop: 6 }}
          value={cfg.url}
          placeholder={defaultServer().url}
          onChange={(e) => setCfg({ ...cfg, url: e.target.value })}
        />
        <div className="faint" style={{ marginTop: 4 }}>默认取当前页面地址（panel 面板所在端口）。</div>
        <div className="stat-label" style={{ marginTop: 16 }}>密钥</div>
        <input
          type="password"
          style={{ width: "100%", marginTop: 6 }}
          value={cfg.secret}
          onChange={(e) => setCfg({ ...cfg, secret: e.target.value })}
        />
        <div className="faint" style={{ marginTop: 4 }}>sing-box API 没设 secret 就留空。</div>
        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn primary"
            onClick={() => {
              saveServer(cfg);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          >
            保存
          </button>
          {saved && <span className="chip ok">已保存</span>}
        </div>
      </div>

      <h2>辅助入口</h2>
      <div className="card">
        <div className="faint">需要 sing-box 原生 API 没有的页面时（规则/规则集/DNS/配置编辑），由同机 sidecar 提供：</div>
        <ul className="faint" style={{ marginTop: 6, marginBottom: 0 }}>
          <li>GET /panel/config — 运行配置 JSON</li>
          <li>PUT /panel/config — 保存配置（重启生效）</li>
          <li>GET /panel/rulesets/&lt;tag&gt; — 已编译规则集解包</li>
          <li>GET /panel/clash/* — Clash API 透传（/rules 等）</li>
          <li>POST /panel/restart — 重启内核（拉规则）</li>
        </ul>
      </div>
    </div>
  );
}
