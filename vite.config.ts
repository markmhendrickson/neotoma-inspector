import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function getDefaultApiUrl(): string {
  if (process.env.VITE_NEOTOMA_API_URL) {
    return process.env.VITE_NEOTOMA_API_URL;
  }
  return process.env.VITE_NEOTOMA_ENV === "prod" ? "http://localhost:3180" : "http://localhost:3080";
}

export default defineConfig(() => {
  const apiUrl = getDefaultApiUrl();

  return {
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
