// Admin page: every trial at a glance, YouCam usage per key, users, the access log and settings.
// Admins only; the API checks again (app/admin.py), this page only decides what to show.
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AccessEntry, AdminOverview, RemoteAccess } from "../../api/types";
import { href } from "../../app/router";
import { useStore } from "../../app/store";
import { Badge, Card, PageHeader, Segmented } from "../../components/ui";
import { personLabel, statusTone } from "../../domain/trial";
import { ago, clock } from "../../lib/time";
import { UsersCard } from "./UsersCard";
import "./account.css";

export function AdminPage() {
  const { me } = useStore();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const admin = !!me?.user?.admin;

  useEffect(() => {
    if (admin) api.admin.overview().then(setData).catch((e: Error) => setError(e.message));
  }, [admin]);

  if (!me) return <p className="muted">Loading…</p>;
  if (!me.user) {
    return (
      <Card className="login-card">
        <h1>Admin</h1>
        <p className="muted">Sign in with an admin account to open this page.</p>
        <a className="button primary" href={href("login", { next: href("admin") })}>Sign in</a>
      </Card>
    );
  }
  if (!admin) return <Card className="login-card"><h1>Admin</h1><p className="muted">This page is for admins.</p></Card>;

  return (
    <>
      <PageHeader title="Admin" description="Trials, YouCam usage, who can sign in, and who opened the lab." />
      {error && <p className="error" role="alert">{error}</p>}
      {data && <TrialsCard data={data} />}
      {data && <UsageCard data={data} onSaved={setData} />}
      <UsersCard />
      {data && <SettingsCard data={data} onSaved={setData} />}
      {data && <AccessLogCard log={data.log} />}
    </>
  );
}

function TrialsCard({ data }: { data: AdminOverview }) {
  return (
    <Card title="Trials">
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Person</th><th>Day</th><th>Today</th><th>Latest photo</th><th>Verdict</th><th>Reminder</th><th>Paid by</th></tr></thead>
          <tbody>
            {data.trials.map((t) => (
              <tr key={t.person}>
                <td><b>{personLabel(t.person)}</b><div className="muted small">{t.product || "No product"}</div></td>
                <td>{t.day === null ? "–" : `${Math.max(0, Math.min(t.day, t.duration_days))} / ${t.duration_days}`}</td>
                <td>
                  {t.today_target === 0 ? <span className="muted">–</span>
                    : t.today_done ? <Badge tone="pass">done</Badge>
                    : <Badge tone="neutral">{t.today_count}/{t.today_target}</Badge>}
                </td>
                <td>
                  {t.latest ? <>{t.latest.stem} {t.latest.gate_passed === false ? <Badge tone="fail">gate failed</Badge> : t.latest.gate_passed ? <Badge tone="pass">passed</Badge> : null}</> : <span className="muted">–</span>}
                </td>
                <td><Badge tone={statusTone(t.verdict)}>{t.verdict}</Badge></td>
                <td>{t.reminder_time ? clock(t.reminder_time) : <span className="muted">not set</span>}</td>
                <td className="small muted">{t.key_var}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function UsageCard({ data, onSaved }: { data: AdminOverview; onSaved: (d: AdminOverview) => void }) {
  const [granted, setGranted] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.usage.map((u) => [u.key_var, u.units_granted?.toString() ?? ""])));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const changed = data.usage.filter((u) => (granted[u.key_var] ?? "") !== (u.units_granted?.toString() ?? "") && /^\d+$/.test(granted[u.key_var] ?? ""));
  const save = () => {
    setBusy(true);
    setNote("");
    api.admin.saveSettings({ units_granted: Object.fromEntries(changed.map((u) => [u.key_var, Number(granted[u.key_var])])) })
      .then((d) => { onSaved(d); setNote("Saved."); })
      .catch((e: Error) => setNote(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Card title="YouCam usage" actions={<button className="small primary" disabled={busy || !changed.length} onClick={save}>Save units</button>}>
      <div className="table-wrap">
        <table className="admin-table">
          <thead><tr><th>Key</th><th>Analyses</th><th>Units used</th><th>Units granted</th><th>Left</th></tr></thead>
          <tbody>
            {data.usage.map((u) => (
              <tr key={u.key_var}>
                <td className="small"><b>{u.key_var}</b></td>
                <td>{u.analyses}</td>
                <td>{u.units_used.toLocaleString()}</td>
                <td>
                  <input className="units-input" inputMode="numeric" pattern="\d*" value={granted[u.key_var] ?? ""} placeholder="e.g. 2000"
                    aria-label={`Units granted for ${u.key_var}`} onChange={(e) => setGranted({ ...granted, [u.key_var]: e.target.value.replace(/\D/g, "") })} />
                </td>
                <td>{u.units_left === null ? <span className="muted">–</span> : <b className={u.units_left < data.units_per_analysis * 20 ? "fail" : ""}>{u.units_left.toLocaleString()}</b>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small admin-note">
        Counted from the results saved on this PC (retakes included): {data.units_per_analysis} units per analysis, a split face is two.
        The YouCam console has the exact balance. {note && <b>{note}</b>}
      </p>
    </Card>
  );
}

const ACCESS: { value: RemoteAccess; label: string }[] = [
  { value: "link_or_signin", label: "Lab link or sign-in" },
  { value: "signin_only", label: "Sign-in only" },
];

function SettingsCard({ data, onSaved }: { data: AdminOverview; onSaved: (d: AdminOverview) => void }) {
  const { me } = useStore();
  const [error, setError] = useState("");
  const providers = (me?.methods ?? []).filter((m) => m !== "password");
  const change = (remote_access: RemoteAccess) => {
    setError("");
    api.admin.saveSettings({ remote_access }).then(onSaved).catch((e: Error) => setError(e.message));
  };
  return (
    <Card title="Settings">
      <div className="admin-setting">
        <div>
          <b>Who gets in</b>
          <p className="muted small">Lab link or sign-in: this PC opens freely, phones with the lab link or a sign-in. Sign-in only: every device signs in first, this PC too, and old lab links stop working. Locked out? On the PC run python -m app.users allow-links.</p>
        </div>
        <Segmented options={ACCESS} value={data.settings.remote_access} onChange={change} />
      </div>
      <div className="admin-setting">
        <div>
          <b>Sign-in methods</b>
          <p className="muted small">Add a provider's keys and ADMIN_EMAILS in .env, then restart the server (see README).</p>
        </div>
        <span>{["Password", ...providers.map((p) => p[0].toUpperCase() + p.slice(1))].join(", ")}</span>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </Card>
  );
}

const EVENT: Record<AccessEntry["event"], string> = {
  "sign-in": "Sign-in", "sign-out": "Sign-out", "lab-open": "Opened the lab", unlock: "Lab link", admin: "Admin change",
};
type Filter = "all" | "signin" | "failed" | "admin";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" }, { value: "signin", label: "Sign-ins" }, { value: "failed", label: "Failed" }, { value: "admin", label: "Changes" },
];

function AccessLogCard({ log }: { log: AccessEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = log.filter((e) => filter === "all" || (filter === "failed" ? !e.ok
    : filter === "signin" ? e.event === "sign-in" || e.event === "sign-out" || e.event === "unlock" : e.event === "admin"));
  return (
    <Card title="Access log" actions={<Segmented options={FILTERS} value={filter} onChange={setFilter} />}>
      {shown.length === 0 ? <p className="muted">Nothing yet.</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>What</th><th>Who</th><th>Device</th><th>Address</th></tr></thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={`${e.at}-${i}`} className={e.ok ? "" : "failed"}>
                  <td className="small" title={new Date(e.at).toLocaleString()}>{ago(e.at)}</td>
                  <td className="wrap">
                    {EVENT[e.event] ?? e.event}
                    {e.method && e.event !== "admin" && <span className="muted small"> · {e.method}</span>}
                    {!e.ok && <> <Badge tone="fail">failed</Badge></>}
                    {e.detail && <div className="muted small">{e.detail}</div>}
                  </td>
                  <td className="small">{e.email ?? <span className="muted">unknown</span>}</td>
                  <td className="small">{e.device}</td>
                  <td className="small muted">{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small admin-note">The last 200 entries. "Opened the lab" is noted once an hour per person and device.</p>
    </Card>
  );
}
