import { defineConfig, type Plugin } from "vite";
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

/** Redirect e.g. `/inspector` → `/inspector/` so Vite's non-root base does not show the HTML hint page. */
function basePathTrailingSlashRedirectPlugin(base: string): Plugin | null {
  if (base === "/" || !base.endsWith("/")) return null;
  const withoutSlash = base.replace(/\/$/, "");
  return {
    name: "neotoma-inspector-base-trailing-slash-redirect",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = req.url ?? "";
        const pathOnly = url.split("?")[0] ?? "";
        if (pathOnly !== withoutSlash) return next();
        const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
        res.statusCode = 308;
        res.setHeader("Location", `${base.replace(/\/$/, "")}/${qs}`);
        res.end();
      });
    },
  };
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

  const devPortRaw =
    process.env.VITE_INSPECTOR_DEV_PORT?.trim() ||
    process.env.INSPECTOR_DEV_PORT?.trim() ||
    "5175";
  const devPort = Number.parseInt(devPortRaw, 10);
  const inspectorDevPort = Number.isFinite(devPort) && devPort > 0 ? devPort : 5175;
  const slashRedirect = basePathTrailingSlashRedirectPlugin(base);

  return {
    base,
    clearScreen: false,
    plugins: [...(slashRedirect ? [slashRedirect] : []), react()],
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
      port: inspectorDevPort,
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
