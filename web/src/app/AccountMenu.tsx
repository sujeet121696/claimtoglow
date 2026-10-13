// Top-bar account control: a round button (the initial when signed in, a person icon when not)
// that opens a small panel: who is signed in and their role (or a Sign in button), the admin page
// (admins only), Appearance (Auto / Light / Dark) and Sign out.
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { LineIcon, PageIcon } from "../components/icons";
import "../features/account/account.css";
import { currentPage, href } from "./router";
import { ThemeSwitch } from "./ThemeSwitch";
import { useStore } from "./store";

export function AccountMenu() {
  const { me, refresh } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!me) return null;
  const u = me.user;
  const label = u ? u.name || u.username || u.email : "";
  const initial = label.slice(0, 1).toUpperCase();
  const close = () => setOpen(false);
  const signOut = () => { close(); api.logout().catch(() => {}).finally(refresh); };

  return (
    <div className="account" ref={ref}>
      <button className={u ? "account-button" : "account-button signed-out"} aria-expanded={open} aria-controls="account-menu"
        aria-label={u ? `Account: ${label}` : "Account"} title={u ? label : "Account"} onClick={() => setOpen(!open)}>
        {u ? initial : <PageIcon page="login" />}
      </button>
      {open && (
        <div className="account-menu" id="account-menu">{/* sections, with a line between each */}
          {u ? (
            <div className="account-who">
              <span className="account-avatar" aria-hidden="true">{initial}</span>
              <div>
                <b>{label}</b>
                {label !== u.email && <span className="muted small">{u.email}</span>}
                <span className={u.admin ? "badge pass" : "badge neutral"}>{u.admin ? "Admin" : "Member"}</span>
              </div>
            </div>
          ) : (
            <div className="account-who signed-out">
              <b>Not signed in</b>
              <span className="muted small">Sign in to open the lab from any device.</span>
              <a className="button primary" href={href("login", { next: currentPage() })} onClick={close}>Sign in</a>
            </div>
          )}
          {u?.admin && (
            <div>
              <a className="account-item" href={href("admin")} onClick={close}>
                <PageIcon page="admin" /> Admin page
              </a>
            </div>
          )}
          <div className="account-theme">
            <span className="small muted">Appearance</span>
            <ThemeSwitch labels />
          </div>
          {u && (
            <div>
              <button className="account-item" onClick={signOut}>
                <LineIcon d={SIGN_OUT} /> Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SIGN_OUT = "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10";
