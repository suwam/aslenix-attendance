import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
      },
    },
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 5173,
    },
  },
});
