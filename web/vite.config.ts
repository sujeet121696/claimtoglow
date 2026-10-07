import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run dev`       → http://localhost:5173 (laptop webcam; localhost may use the camera)
// `npm run dev:phone` → https://<pc-ip>:5173 on the LAN, so a phone browser can use its camera
export default defineConfig(({ mode }) => {
  const phone = mode === "phone";
  const api = `http://127.0.0.1:${process.env.API_PORT ?? 8000}`;
  return {
    plugins: [react(), ...(phone ? [basicSsl()] : [])],
    server: {
      host: phone ? true : "localhost",
      // xfwd passes the real client address on, so the API can tell this PC from the phone.
      proxy: {
        "/api": { target: api, xfwd: true },
        "/files": { target: api, xfwd: true },
      },
    },
  };
});
