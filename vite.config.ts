import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = env.VITE_BASE_PATH || "/";

  return {
    base: base.endsWith("/") ? base : `${base}/`,
    plugins: [react()],
    build: {
      sourcemap: false,
      target: "es2022",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("vosviewer-online")) return "vosviewer";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("@tanstack")) return "query";
          },
        },
      },
    },
  };
});
