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
  },
});
