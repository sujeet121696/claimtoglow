import { useState } from "react";
import { useInstall } from "../lib/install";

/** "Install app" in the top bar, only when the app isn't installed yet and the browser allows it. */
export function InstallButton() {
  const [mode, install] = useInstall();
  const [showSteps, setShowSteps] = useState(false);
  if (!mode) return null;

  if (mode === "prompt") return <button className="small install" onClick={() => void install()}>Install app</button>;
  return (
    <span className="install-ios">
      <button className="small install" onClick={() => setShowSteps((s) => !s)} aria-expanded={showSteps}>Install app</button>
      {showSteps && <span className="install-steps small" role="note">In Safari: tap Share, then Add to Home Screen.</span>}
    </span>
  );
}
