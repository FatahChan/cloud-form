import { fileURLToPath, URL } from "node:url";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { FORM_TEMPLATES } from "./src/shared/form-templates";
import { exampleHead, homepageHead, replaceMarkedHead, robotsTxt, sitemapXml } from "./src/shared/seo";

const src = fileURLToPath(new URL("./src", import.meta.url));
const outDir = fileURLToPath(new URL("./dist-site", import.meta.url));
const logo = fileURLToPath(new URL("./src/components/cloud-form-logo.svg", import.meta.url));

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
      name: "site-static",
      transformIndexHtml(html) {
        return replaceMarkedHead(html, homepageHead());
      },
      closeBundle() {
        const indexHtml = readFileSync(resolve(outDir, "index.html"), "utf8");
        copyFileSync(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
        copyFileSync(logo, resolve(outDir, "favicon.svg"));
        writeFileSync(resolve(outDir, "sitemap.xml"), sitemapXml(FORM_TEMPLATES.map((t) => t.id)));
        writeFileSync(resolve(outDir, "robots.txt"), robotsTxt());
        for (const t of FORM_TEMPLATES) {
          const dir = resolve(outDir, "examples", t.id);
          mkdirSync(dir, { recursive: true });
          writeFileSync(
            resolve(dir, "index.html"),
            replaceMarkedHead(indexHtml, exampleHead({ id: t.id, name: t.name, description: t.description })),
          );
        }
      },
    },
  ],
  build: {
    outDir,
    emptyOutDir: true,
  },
});
