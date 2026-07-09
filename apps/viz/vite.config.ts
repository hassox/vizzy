import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    // Critical: one Three.js instance. Multiple copies = blank WebGL canvas
    // (meshes from three-globe won't render with globe.gl's renderer).
    dedupe: ["three"],
  },
  optimizeDeps: {
    include: ["globe.gl", "three", "three-globe", "three-render-objects"],
  },
});
