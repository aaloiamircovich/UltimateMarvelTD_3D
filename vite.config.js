import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: { game: "index.html", studio: "art-studio.html" },
      output: {
        manualChunks: (id) =>
          id.includes("node_modules/three") ? "three" : undefined,
      },
    },
  },
});
