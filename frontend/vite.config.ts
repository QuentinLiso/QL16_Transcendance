import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/api/ws": { target: "ws://localhost:5000", ws: true },
      "/uploads": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
});
