import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function getDefaultApiUrl(): string {
  if (process.env.VITE_NEOTOMA_API_URL) {
    return process.env.VITE_NEOTOMA_API_URL;
  }
  return process.env.VITE_NEOTOMA_ENV === "prod" ? "http://localhost:3180" : "http://localhost:3080";
}

function normalizeBasePath(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(() => {
  const apiUrl = getDefaultApiUrl();
  // Default `/inspector/` matches how Neotoma mounts the bundled SPA. Without
  // this, `vite build` emits `/assets/...` and the browser loads HTML (wrong
  // MIME) for CSS/JS. Override with `VITE_PUBLIC_BASE_PATH=/` (or a repo path)
  // for GitHub Pages and other hosts — see `inspector/README.md`.
  const explicitBase = process.env.VITE_PUBLIC_BASE_PATH?.trim();
  const base = normalizeBasePath(explicitBase ?? "/inspector/");
  /** When set (e.g. `../dist/inspector`), `vite build --watch` updates the tree the API serves first. */
  const outDirFromEnv = process.env.NEOTOMA_INSPECTOR_OUT_DIR?.trim();
  const buildOutDir = outDirFromEnv
    ? path.resolve(__dirname, outDirFromEnv)
    : path.resolve(__dirname, "dist");
  const outDirOutsideRoot =
    path.relative(__dirname, buildOutDir).startsWith("..") ||
    path.relative(__dirname, buildOutDir).includes("..");

  return {
    base,
    clearScreen: false,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      outDir: buildOutDir,
      emptyOutDir: outDirOutsideRoot ? true : undefined,
    },
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
  };
});
