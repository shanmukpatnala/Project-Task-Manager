import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Required for GitHub Pages
  base: "/Project-Task-Manager/",

  server: {
    host: "localhost",
    port: 3001,
    strictPort: true,
  },
});