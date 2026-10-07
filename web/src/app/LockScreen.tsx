// Shown when this device has no valid lab token: says why (from the server) and lets the person
// paste the lab link, for when opening it didn't unlock the device.
import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { Card } from "../components/ui";
import { tokenFrom } from "../lib/labToken";
import { useStore } from "./store";

export function LockScreen({ reason }: { reason: string }) {
  const { refresh } = useStore();
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
      .then(() => { setText(""); refresh(); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <Card className="lock-screen">
      <h2>This device is locked</h2>
      <p className="muted">{reason}</p>
      <form onSubmit={unlock} className="lock-form">
        <label className="field">
          <span className="field-label">Or paste the lab link</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…/?token=…" autoComplete="off" />
        </label>
        <button type="submit" className="primary" disabled={!text.trim() || busy}>{busy ? "Unlocking…" : "Unlock"}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </Card>
  );
}
