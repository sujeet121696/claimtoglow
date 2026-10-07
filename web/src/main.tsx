import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { adoptTokenFromUrl } from "./lib/labToken";
import "./lib/install"; // listens for the install prompt from the first moment
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";

// Unlock first (when opened from a lab link), so the first data load already carries the cookie.
adoptTokenFromUrl().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
