import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync } from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Copy index.html → 404.html after build for GitHub Pages SPA fallback
    {
      name: 'spa-fallback',
      closeBundle() {
        try {
          cpSync('dist/index.html', 'dist/404.html');
        } catch {}
      },
    },
  ],
  server: {
    historyApiFallback: true,
  },
})
