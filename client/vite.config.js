import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    // Ensure index.json is copied to dist
    copyPublicDir: true
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: []
  },
  server: {
    // NOTE: COOP/COEP can break asset loading on some browsers (notably iOS Safari)
    // when running over plain HTTP in dev. Enable only when you specifically need
    // crossOriginIsolated features (e.g. SharedArrayBuffer).
    headers: process.env.VITE_COEP === '1'
      ? {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp'
        }
      : undefined,
    middlewareMode: false,
    fs: {
      strict: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  assetsInclude: ['**/*.wasm'],
  publicDir: 'public'
})
