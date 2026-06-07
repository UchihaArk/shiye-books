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
  },
})
