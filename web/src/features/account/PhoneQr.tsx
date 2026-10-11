// On a computer's sign-in page: a QR code of the sign-in address (the tunnel's when set), so a phone
// opens it by scanning. Only the address, never the lab token: this page is public.
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { href } from "../../app/router";

export function PhoneQr({ publicUrl }: { publicUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState("");
  const url = `${publicUrl ?? window.location.origin}${href("login")}`;

  useEffect(() => {
    if (open) QRCode.toDataURL(url, { margin: 1, width: 200 }).then(setQr).catch(() => setQr(""));
  }, [open, url]);

  // A phone is already where it should be.
  if (window.matchMedia("(pointer: coarse)").matches) return null;
  if (!open) return <button type="button" className="link-button login-switch" onClick={() => setOpen(true)}>Sign in on your phone instead</button>;
  return (
    <div className="login-phone">
      {qr && <img src={qr} alt={`QR code for ${url}`} width={160} height={160} />}
      <p className="muted small">Scan with the phone camera, then sign in there. Or open <b>{url.replace(/^https?:\/\//, "")}</b></p>
    </div>
  );
}
