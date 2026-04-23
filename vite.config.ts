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
  const base = normalizeBasePath(process.env.VITE_PUBLIC_BASE_PATH);

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
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
