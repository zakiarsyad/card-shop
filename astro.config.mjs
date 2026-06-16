// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Static by default — the Payment Element is the only interactive island
// (see docs/STANDARDS.md → Performance). Server logic lives in Netlify
// Functions under netlify/functions, not in Astro routes.
export default defineConfig({
  site: "https://checkout.zakiarsyad.com",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
    // Dev-only: let an HTTPS tunnel (e.g. cloudflared) reach the dev server so
    // providers that require HTTPS (Xendit Components) can be tested locally.
    server: { allowedHosts: [".trycloudflare.com"] },
  },
});
