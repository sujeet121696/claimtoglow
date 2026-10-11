// On the sign-in page while lab links are allowed: paste the lab link from "Open on phone", for a
// device where opening it didn't unlock the lab (e.g. a sign-in step dropped ?token=).
import { useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { tokenFrom } from "../../lib/labToken";

export function LabLinkForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const unlock = (e: FormEvent) => {
    e.preventDefault();
    const token = tokenFrom(text);
    if (!token) return setError("That doesn't look like a lab link. Copy it again from “Open on phone”.");
    setBusy(true);
    setError("");
    api.unlock(token)
      .then(() => { setText(""); onUnlocked(); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  if (!open) return <button type="button" className="link-button login-switch" onClick={() => setOpen(true)}>Have a lab link? Paste it</button>;
  return (
    <form onSubmit={unlock} className="lock-form">
      <label className="field">
        <span className="field-label">Lab link</span>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…/?token=…" autoComplete="off" autoFocus />
      </label>
      <button type="submit" disabled={!text.trim() || busy}>{busy ? "Unlocking…" : "Unlock"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
