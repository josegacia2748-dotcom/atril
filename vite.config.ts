import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("opensheetmusicdisplay") || id.includes("vexflow")) return "osmd";
          if (id.includes("pdfjs-dist")) return "pdf";
          if (id.includes("node_modules/tone")) return "audio";
          if (id.includes("jspdf")) return "pdfgen";
          return undefined;
        },
      },
    },
  },
});
