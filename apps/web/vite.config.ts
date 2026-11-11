import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/v1": "http://localhost:4000",
      "/healthz": "http://localhost:4000",
      "/readyz": "http://localhost:4000",
      "/documentation": "http://localhost:4000",
    },
  },
});
