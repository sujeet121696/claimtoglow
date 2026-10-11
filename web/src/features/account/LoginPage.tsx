// Sign in, as kharidwise does it: provider buttons (only the ones set up in .env), then one form that
// either emails a one-time sign-in link or takes a password, with a button to switch. Accounts are
// invite-only (app/auth.py). It starts in link mode, because teammates added without a password can
// only use a link or a provider; the mode and email are remembered on this device.
// Opening an emailed link lands here with ?code=…: one press on "Sign in" uses it (a press, so mail
// scanners that open links can't use it up). After signing in, the page goes to `next`.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { href, navigate, useRoute } from "../../app/router";
import { useStore } from "../../app/store";
import { Card } from "../../components/ui";
import { loadPref, savePref } from "../../lib/storage";
import { LabLinkForm } from "./LabLinkForm";
import { PhoneQr } from "./PhoneQr";
import "./account.css";

// Brand marks (24×24), as on kharidwise's sign-in page.
const PROVIDERS = [
  { id: "google", label: "Google", icon: <><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" /></> },
  { id: "github", label: "GitHub", icon: <path fill="currentColor" d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" /> },
  { id: "linkedin", label: "LinkedIn", icon: <path fill="#0A66C2" d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z" /> },
] as const;

// Why a provider sign-in came back without signing in (?error= from app/auth.py).
const ERRORS: Record<string, string> = {
  not_invited: "This account isn't invited yet. Ask an admin to add your email.",
  unverified: "That account's email isn't verified with the provider. Verify it there, or use another way.",
  disabled: "This account is turned off. Ask an admin.",
  cancelled: "Sign-in was cancelled.",
  expired: "The sign-in took too long or started in another browser. Try again.",
  provider: "Couldn't reach the sign-in provider. Try again.",
  unavailable: "That sign-in method isn't set up.",
};

const RESEND_SECONDS = 60; // the server sends at most one link a minute per address

/** Only a page of this lab, never the sign-in page itself (app/auth.py checks the same on the server). */
function nextPage(raw: string | null): string {
  const ok = raw && raw.startsWith("/") && !raw.startsWith("//") && !/^\/(api|files|demo)/.test(raw) && !raw.startsWith(href("login"));
  return ok ? raw : href("today");
}

/** A web inbox to open after a link was sent, for the common providers; null for others. */
function inboxFor(email: string): { label: string; url: string } | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { label: "Open Gmail", url: "https://mail.google.com/mail/u/0/#search/" + encodeURIComponent("Claim to Glow sign-in newer_than:1d") };
  }
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return { label: "Open Outlook", url: "https://outlook.live.com/mail/0/" };
  return null;
}

export function LoginPage() {
  const [route] = useRoute();
  const { me, refresh, locked } = useStore();
  const next = nextPage(route.params.get("next"));
  const token = route.params.get("code"); // from an emailed sign-in link
  const methods = me?.methods ?? [];
  const hasLink = methods.includes("email");
  const hasPassword = methods.includes("password");

  const [linkMode, setLinkMode] = useState(() => loadPref("loginMode", "link") === "link");
  const [login, setLogin] = useState(() => loadPref("loginEmail"));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>(() => {
    const e = route.params.get("error");
    return e ? ERRORS[e] ?? ERRORS.provider : "";
  });
  const [sentTo, setSentTo] = useState("");
  const [wait, setWait] = useState(0); // seconds until another link may be sent
  const [linkFailed, setLinkFailed] = useState(false); // the emailed link didn't work: show the form again

  const linkForm = hasLink && (linkMode || !hasPassword); // link mode, or the only form there is

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Reload the account and the lab first, so the next page doesn't still see this device as locked.
  const done = () => refresh().then(() => navigate(next, { replace: true }));

  const switchMode = () => {
    setLinkMode(!linkForm);
    savePref("loginMode", linkForm ? "password" : "link");
    setMessage("");
    setSentTo("");
  };

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    work().catch((err: Error) => setMessage(err.message)).finally(() => setBusy(false));
  };

  const sendLink = (email: string) => run(() => api.emailLink(email, next).then(() => { setSentTo(email); setWait(RESEND_SECONDS); }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = login.trim();
    savePref("loginEmail", id);
    if (!linkForm) return run(() => api.passwordLogin(id, password).then(() => { setPassword(""); done(); }));
    if (!id.includes("@")) return setMessage("Enter your email address to get a link.");
    sendLink(id);
  };

  const finishLink = () => {
    if (token) run(() => api.emailVerify(token).then(done).catch((err: Error) => { setLinkFailed(true); throw err; }));
  };

  if (me?.user && !token) {
    return (
      <Card className="login-card">
        <h1>Signed in</h1>
        <p className="muted">as {me.user.name || me.user.username || me.user.email}</p>
        <div className="login-actions">
          <a className="button primary" href={next}>Continue</a>
          {me.user.admin && <a className="button" href={href("admin")}>Admin</a>}
        </div>
      </Card>
    );
  }

  const confirming = Boolean(token) && !linkFailed;
  const providers = PROVIDERS.filter((p) => methods.includes(p.id));
  const inbox = sentTo ? inboxFor(sentTo) : null;

  return (
    <Card className="login-card">
      <h1>{confirming ? "Finish signing in" : "Sign in"}</h1>
      <p className="muted">{confirming ? "Press the button to finish signing in. The link works once." : "For the Claim to Glow team. Accounts are by invitation."}</p>
      {message && <p className="login-msg" role="alert">{message}</p>}

      {confirming ? (
        <button className="primary login-submit" disabled={busy} onClick={finishLink}>{busy ? "Signing in…" : "Sign in"}</button>
      ) : (
        <>
          {providers.length > 0 && (
            <>
              <div className="login-providers">
                {providers.map((p) => (
                  <a key={p.id} className="button provider" href={api.oauthUrl(p.id, next)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{p.icon}</svg>
                    Continue with {p.label}
                  </a>
                ))}
              </div>
              <p className="login-or muted small"><span>or</span></p>
            </>
          )}

          {sentTo && linkForm ? (
            <div className="login-sent" role="status">
              <p><b>Check your inbox.</b> If {sentTo} has an account, a sign-in link from Claim to Glow is on its way. It works once, for 15 minutes.</p>
              <div className="login-actions">
                {inbox && <a className="button primary" href={inbox.url} target="_blank" rel="noopener noreferrer">{inbox.label}</a>}
                <button disabled={busy || wait > 0} onClick={() => sendLink(sentTo)}>{wait > 0 ? `Send again in ${wait}s` : "Send again"}</button>
                <button className="link-button" onClick={() => { setSentTo(""); setWait(0); }}>Use another email</button>
              </div>
              <p className="muted small">Not there? Look in spam or promotions.</p>
            </div>
          ) : (
            <form className="login-form" onSubmit={submit}>
              <label className="field">
                <span className="field-label">{linkForm ? "Email" : "Email or username"}</span>
                <input type={linkForm ? "email" : "text"} value={login} onChange={(e) => setLogin(e.target.value)}
                  autoComplete={linkForm ? "email" : "username"} autoCapitalize="none" spellCheck={false} required />
              </label>
              {!linkForm && (
                <label className="field">
                  <span className="field-label">Password</span>
                  <span className="login-password">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password" required />
                    <button type="button" className="ghost small" aria-pressed={showPassword} aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button>
                  </span>
                </label>
              )}
              <button type="submit" className="primary login-submit" disabled={busy || !login.trim() || (!linkForm && !password)}>
                {busy ? (linkForm ? "Sending…" : "Signing in…") : linkForm ? "Email me a sign-in link" : "Sign in"}
              </button>
              {hasLink && hasPassword && (
                <button type="button" className="link-button login-switch" onClick={switchMode}>
                  {linkForm ? "Use my password instead" : "Email me a sign-in link instead"}
                </button>
              )}
            </form>
          )}

          {locked && me?.lab_links && <LabLinkForm onUnlocked={done} />}
          {me && <PhoneQr publicUrl={me.public_url} />}

          <p className="login-trust muted small">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            Passwords are kept only as a salted one-way hash. Original photos never leave the lab PC.
          </p>
        </>
      )}
    </Card>
  );
}
