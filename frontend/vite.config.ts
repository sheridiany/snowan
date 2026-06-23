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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@lobehub/ui')) return 'lobehub';
          if (id.includes('lucide-react')) return 'icons';
          if (
            id.includes('react-markdown') ||
            id.includes('remark') ||
            id.includes('rehype') ||
            id.includes('mermaid') ||
            id.includes('micromark') ||
            id.includes('mdast') ||
            id.includes('hast')
          )
            return 'markdown';
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-'))
            return 'antd';
          return undefined;
        },
      },
    },
  },
});
