// Demo mode (npm run build:demo): the read-only judge demo. Static data, no faces, no lab actions.
export const DEMO = import.meta.env.MODE === "demo";

if (DEMO) document.title = "Claim to Glow · Demo";
