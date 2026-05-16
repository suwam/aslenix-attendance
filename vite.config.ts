import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 5173,
    },
  },
});
