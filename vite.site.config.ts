import { fileURLToPath, URL } from "node:url";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const src = fileURLToPath(new URL("./src", import.meta.url));
const outDir = fileURLToPath(new URL("./dist-site", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./site", import.meta.url)),
  publicDir: fileURLToPath(new URL("./site/public", import.meta.url)),
  base: process.env.SITE_BASE || "/",
  server: { port: 4173 },
  resolve: {
    alias: { "~": src, "@": src },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "spa-404",
      closeBundle() {
        copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
      },
    },
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
});
