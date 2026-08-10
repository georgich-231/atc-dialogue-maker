import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/atc-dialogue-maker/",
  plugins: [react()],
  worker: {
    format: "es"
  },
  build: {
    outDir: "pages-dist",
    emptyOutDir: true
  }
});
