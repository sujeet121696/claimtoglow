// Admin: the accounts that may sign in. Add one (with or without a password: without, the person
// uses Google, GitHub or LinkedIn with that email), make admin, turn off, set a password, remove.
// Your own account and the owners in ADMIN_EMAILS can't be changed here (app/admin.py): use
// python -m app.users on the PC.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { AdminUser, NewUser } from "../../api/types";
import { useStore } from "../../app/store";
import { Badge, Card, Field } from "../../components/ui";
import { ago } from "../../lib/time";

const BLANK: NewUser = { email: "", username: "", name: "", admin: false, password: "" };

export function UsersCard() {
  const { me } = useStore();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [form, setForm] = useState<NewUser>(BLANK);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ id: number; action: "password" | "remove" } | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.admin.users().then(setUsers).catch((e: Error) => setError(e.message)); }, []);

  const run = (work: Promise<AdminUser[]>, after?: () => void) => {
    setBusy(true);
    setError("");
    work.then((u) => { setUsers(u); after?.(); }).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    run(api.admin.addUser(form), () => { setForm(BLANK); setAdding(false); });
  };
  const set = (k: keyof NewUser) => (e: { target: { value: string; checked: boolean; type: string } }) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <Card title="Users" actions={!adding && <button className="small" onClick={() => setAdding(true)}>Add user</button>}>
      {adding && (
        <form className="admin-form" onSubmit={add}>
          <Field label="Email"><input type="email" value={form.email} onChange={set("email")} required autoComplete="off" /></Field>
          <Field label="Username" hint="Optional, for password sign-in"><input value={form.username} onChange={set("username")} autoCapitalize="none" autoComplete="off" /></Field>
          <Field label="Name" hint="Optional"><input value={form.name} onChange={set("name")} autoComplete="off" /></Field>
          <Field label="Password" hint="Optional, 10+ characters. Without one: Google, GitHub or LinkedIn with this email.">
            <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <label className="option"><input type="checkbox" checked={form.admin} onChange={set("admin")} /> Admin (can open this page)</label>
          <div className="admin-form-actions">
            <button type="submit" className="primary" disabled={busy || !form.email}>Add</button>
            <button type="button" className="ghost" onClick={() => { setAdding(false); setForm(BLANK); }}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {!users ? <p className="muted">Loading…</p> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Account</th><th>Sign-in</th><th>Role</th><th>Last seen</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {users.map((u) => {
                const self = u.email === me?.user?.email;
                return (
                  <tr key={u.id} className={u.disabled ? "off" : ""}>
                    <td>
                      <b>{u.name || u.username || u.email}</b>
                      {(u.name || u.username) && <div className="muted small">{u.email}{u.username && u.name ? ` · ${u.username}` : ""}</div>}
                    </td>
                    <td className="small">{u.methods.join(", ") || <span className="muted">not yet</span>}</td>
                    <td>
                      {u.admin ? <Badge tone="pass">admin</Badge> : <Badge tone="neutral">member</Badge>}
                      {u.owner && <span className="muted small"> owner</span>}
                      {u.disabled && <> <Badge tone="fail">off</Badge></>}
                    </td>
                    <td className="small muted">{u.last_seen_at ? ago(u.last_seen_at) : "never"}</td>
                    <td>
                      <div className="admin-actions">
                        {self ? <span className="muted small">you</span> : u.owner ? <span className="muted small">change on the PC</span> : pending?.id === u.id && pending.action === "password" ? (
                          <form onSubmit={(e) => { e.preventDefault(); run(api.admin.changeUser(u.id, { password }), () => { setPending(null); setPassword(""); }); }}>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" aria-label="New password" />
                            <button type="submit" className="small primary" disabled={busy || password.length < 10}>Save</button>
                            <button type="button" className="small ghost" onClick={() => { setPending(null); setPassword(""); }}>Cancel</button>
                          </form>
                        ) : pending?.id === u.id && pending.action === "remove" ? (
                          <>
                            <button className="small danger" disabled={busy} onClick={() => run(api.admin.removeUser(u.id), () => setPending(null))}>Remove {u.email}?</button>
                            <button className="small ghost" onClick={() => setPending(null)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button className="small" disabled={busy} onClick={() => run(api.admin.changeUser(u.id, { admin: !u.admin }))}>{u.admin ? "Make member" : "Make admin"}</button>
                            <button className="small" disabled={busy} onClick={() => run(api.admin.changeUser(u.id, { disabled: !u.disabled }))}>{u.disabled ? "Turn on" : "Turn off"}</button>
                            <button className="small" disabled={busy} onClick={() => setPending({ id: u.id, action: "password" })}>Set password</button>
                            <button className="small ghost" disabled={busy} onClick={() => setPending({ id: u.id, action: "remove" })}>Remove</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
