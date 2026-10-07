// "Open on phone": a QR code with the lab's address and token. Opening it unlocks the lab on that
// device, with no typing. Two routes: the Cloudflare Tunnel (anywhere, when PUBLIC_URL is set) or
// this PC's Wi-Fi address (npm run dev:phone).
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Segmented } from "../../components/ui";

type Route = "public" | "wifi";

const STEPS: Record<Route, string[]> = {
  public: [
    "Scan the code with the phone camera, or copy the link and send it privately.",
    "Sign in with your email when Cloudflare asks (only team emails are allowed).",
    "This PC and the tunnel must be running.",
  ],
  wifi: [
    "Run npm run dev:phone on this PC, phone on the same Wi-Fi.",
    "Scan the code with the phone camera.",
    "If Chrome warns the connection isn't private: Advanced → Proceed.",
  ],
};

export function PhoneLink() {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<{ wifi: string; public: string | null } | null>(null);
  const [route, setRoute] = useState<Route>("wifi");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    api.labLink()
      .then((l) => { setLinks(l); setRoute(l.public ? "public" : "wifi"); })
      .catch((e) => setError((e as Error).message));
  }, [open]);

  const url = links ? (route === "public" ? links.public : links.wifi) : null;

  useEffect(() => {
    setCopied(false);
    if (url) QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setQr).catch((e) => setError((e as Error).message));
  }, [url]);

  const copy = () => { if (url) navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => setError("Copy failed. Use the QR code instead.")); };

  return (
    <>
      <button onClick={() => setOpen(true)}>Open on phone</button>
      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="dialog card phone-link" role="dialog" aria-modal="true" aria-labelledby="phone-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="phone-title">Open the lab on your phone</h2>
            {links?.public && (
              <Segmented<Route>
                options={[{ value: "public", label: "Anywhere" }, { value: "wifi", label: "Same Wi-Fi" }]}
                value={route}
                onChange={setRoute}
              />
            )}
            {qr ? <img src={qr} alt="QR code that opens the lab on a phone" width={240} height={240} /> : !error && <p className="muted">Making the code…</p>}
            {error && <p className="error">{error}</p>}
            <ol className="small">{STEPS[route].map((s) => <li key={s}>{s}</li>)}</ol>
            <p className="muted small">The link contains this lab's private key. Share it only with the team.</p>
            <div className="dialog-actions">
              {url && <button onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>}
              <button onClick={() => setOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
