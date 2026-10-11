// Top-bar account control: "Sign in" when signed out; when signed in, a round initial that opens a
// small menu with the account, the admin page (admins only) and Sign out.
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { PageIcon } from "../components/icons";
import "../features/account/account.css";
import { currentPage, href } from "./router";
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
  if (!me.user) {
    return (
      <a className="button account-button signed-out" href={href("login", { next: currentPage() })} aria-label="Sign in" title="Sign in">
        <PageIcon page="login" />
      </a>
    );
  }

  const u = me.user;
  const label = u.name || u.username || u.email;
  const signOut = () => { setOpen(false); api.logout().catch(() => {}).finally(refresh); };

  return (
    <div className="account" ref={ref}>
      <button className="account-button" aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${label}`} onClick={() => setOpen(!open)}>
        {label.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <b>{label}</b>
            {label !== u.email && <span className="muted small">{u.email}</span>}
          </div>
          {u.admin && (
            <a role="menuitem" href={href("admin")} onClick={() => setOpen(false)}>
              <PageIcon page="admin" /> Admin
            </a>
          )}
          <button role="menuitem" className="link-button" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}
