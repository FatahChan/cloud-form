import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  server: { port: 3000 },
  resolve: {
    alias: { "~": src, "@": src },
  },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react(), tailwindcss()],
});
