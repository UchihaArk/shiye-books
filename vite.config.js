import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, existsSync, statSync } from 'fs'
import { resolve, extname } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Dev mode: serve dist/api/ and data/ as static files
    {
      name: 'serve-local-data',
      configureServer(server) {
        const MIME = {
          '.json': 'application/json',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        };
        const dirs = [
          { prefix: '/api', root: resolve('dist/api') },
          { prefix: '/data', root: resolve('data') },
        ];
        server.middlewares.use((req, res, next) => {
          for (const { prefix, root } of dirs) {
            if (req.url.startsWith(prefix)) {
              const file = resolve(root, decodeURIComponent(req.url.slice(prefix.length).replace(/^\//, '')));
              // Prevent path traversal
              if (!file.startsWith(root)) break;
              if (existsSync(file) && statSync(file).isFile()) {
                res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
                createReadStream(file).pipe(res);
                return;
              }
            }
          }
          next();
        });
      },
    },
  ],
  server: {
    historyApiFallback: true,
    // 仅代理动态 Pages-Functions 端点到本地 `wrangler pages dev`（npm run dev:server）。
    // 静态 /api/index.json 与 /api/essay/*.json 不代理 —— 仍由上面的 serve-local-data
    // 中间件从 dist/api 提供，保持前端 HMR 不受影响。
    proxy: {
      '/api/stats': { target: 'http://localhost:8788', changeOrigin: true },
      '/api/progress': { target: 'http://localhost:8788', changeOrigin: true },
      '/api/comments': { target: 'http://localhost:8788', changeOrigin: true },
      '/api/meta': { target: 'http://localhost:8788', changeOrigin: true },
    },
  },
})
