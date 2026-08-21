import { NavLink, Route, Routes } from "react-router-dom";
import { OverviewPage } from "./pages/Overview";
import { GroupsPage } from "./pages/Groups";
import { ConnectionsPage } from "./pages/Connections";
import { RulesPage } from "./pages/Rules";
import { RuleSetsPage } from "./pages/RuleSets";
import { DnsPage } from "./pages/Dns";
import { ConfigPage } from "./pages/Config";
import { LogsPage } from "./pages/Logs";
import { SetupPage } from "./pages/Setup";

const links: { to: string; label: string }[] = [
  { to: "/", label: "概览" },
  { to: "/groups", label: "代理组" },
  { to: "/connections", label: "连接" },
  { to: "/rules", label: "规则" },
  { to: "/rulesets", label: "规则集" },
  { to: "/dns", label: "DNS" },
  { to: "/logs", label: "日志" },
  { to: "/config", label: "配置" },
  { to: "/settings", label: "设置" },
];

export function App() {
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">sb-panel</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => (isActive ? "nav active" : "nav")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">sing-box 原生 API</div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/rulesets" element={<RuleSetsPage />} />
          <Route path="/dns" element={<DnsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/settings" element={<SetupPage />} />
        </Routes>
      </main>
    </div>
  );
}
