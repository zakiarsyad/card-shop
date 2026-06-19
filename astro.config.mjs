// @ts-check
import { defineConfig } from "astro/config";

// Static by default — the Payment Element is the only interactive island
// (see docs/STANDARDS.md → Performance). Server logic lives in Netlify
// Functions under netlify/functions, not in Astro routes.
// Styling is plain CSS with custom properties (src/styles/global.css) — no CSS
// framework; the design tokens are hand-authored variables.
export default defineConfig({
  site: "https://checkout.zakiarsyad.com",
  output: "static",
  vite: {
    // Dev-only: let an HTTPS tunnel (e.g. cloudflared) reach the dev server so
    // providers that require HTTPS (Xendit Components) can be tested locally.
    server: { allowedHosts: [".trycloudflare.com"] },
  },
});
