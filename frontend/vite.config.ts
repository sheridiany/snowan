import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri: don't clear the screen so we can read Rust compiler errors.
  clearScreen: false,

  server: {
    port: 5173,
    // Tauri expects a fixed port; fail if it's already in use.
    strictPort: true,
    // Tauri reads the devUrl from tauri.conf.json; don't bind to 0.0.0.0.
    host: false,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },

  build: {
    // Tauri supports modern macOS/Safari 15+.
    target: 'safari15',
    // Minify for smaller bundles.
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for Tauri debug builds.
    sourcemap: !!process.env.TAURI_DEBUG,
    // NOTE: no manualChunks — splitting react/antd/@lobehub into separate chunks
    // breaks init order ("Cannot set properties of undefined (setting 'Activity')")
    // and white-screens the app. Tauri loads from disk so a single chunk is fine.
  },
});
