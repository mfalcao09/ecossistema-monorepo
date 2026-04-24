import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs/promises";

/**
 * Substitui __SW_VERSION__ no dist/sw.js por uma versão única do build.
 *
 * Por que isso é necessário:
 * - public/sw.js é copiado byte-a-byte para dist/sw.js
 * - Se o sw.js fica idêntico entre deploys, o browser não detecta nova versão
 *   e nunca reinstala o Service Worker
 * - SW antigo continua servindo chunks antigos -> mistura de bundles ->
 *   "Cannot read properties of null (reading 'useContext')"
 *
 * Fonte da versão (em ordem de preferência):
 * 1. VERCEL_GIT_COMMIT_SHA — Vercel injeta a cada deploy
 * 2. Date.now() em base36 — fallback local
 */
function swVersionPlugin(): Plugin {
  let version: string;
  return {
    name: "sw-version-replacer",
    apply: "build",
    configResolved() {
      const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
      version = sha || `dev-${Date.now().toString(36)}`;
    },
    closeBundle: {
      sequential: true,
      async handler() {
        const swPath = path.resolve(__dirname, "dist/sw.js");
        try {
          const content = await fs.readFile(swPath, "utf-8");
          if (!content.includes("__SW_VERSION__")) {
            console.warn(
              "[sw-version] dist/sw.js não contém placeholder __SW_VERSION__ — o SW não será versionado",
            );
            return;
          }
          const replaced = content.replace(/__SW_VERSION__/g, version);
          await fs.writeFile(swPath, replaced, "utf-8");
          console.log(`[sw-version] sw.js versionado como: ${version}`);
        } catch (err) {
          console.warn(`[sw-version] Falha ao versionar sw.js:`, err);
        }
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), swVersionPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Dividir o bundle por rota para carregamento mais rápido
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
          ],
          charts: ["recharts"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
        },
      },
    },
  },
});
