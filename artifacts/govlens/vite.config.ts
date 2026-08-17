import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createLogger, defineConfig } from 'vite';

const logger = createLogger();
const logError = logger.error.bind(logger);
logger.error = (msg, options) => {
  const text = String(msg);
  // Expected on a UI-only checkout: nothing listens on :8080.
  if (text.includes('http proxy error') || text.includes('ECONNREFUSED')) {
    return;
  }
  logError(msg, options);
};

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;
// PORT is only required for the dev/preview server, not for production builds
const port = rawPort ? Number(rawPort) : 3100;
const mockSchemes =
  process.env.VITE_MOCK_SCHEMES === '1' || process.env.USE_MOCK_SCHEMES === '1';

// BASE_PATH is required for dev server routing; default to '/' for production builds
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  customLogger: logger,
  base: basePath,
  define: {
    'import.meta.env.VITE_MOCK_SCHEMES': JSON.stringify(mockSchemes ? '1' : '0'),
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Each huge data file gets its own async chunk
          if (id.includes('cag-reports-hi.json'))  return 'data-cag-hi';
          if (id.includes('state-facts-hi'))        return 'data-sf-hi';
          if (id.includes('cag-catalogue.json'))    return 'data-cag-catalogue';
          if (id.includes('cag-reports.ts') || id.includes('cag-reports/'))
                                                    return 'data-cag';
          // Vendor splitting — ALL React-dependent packages must be co-located
          // with react-dom/scheduler to guarantee initialisation order.
          // Separate chunks cause "Cannot set properties of undefined" crashes.
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory'))
                                                    return 'vendor-charts';
            if (id.includes('i18next'))             return 'vendor-i18n';
            if (id.includes('@tanstack'))           return 'vendor-query';
            // Everything else in node_modules goes into vendor-react to ensure
            // React initialises before any library that depends on it
            return 'vendor-react';
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      // Live schemes/CAG/news when the API is up. Without this, Vite
      // serves index.html for /api/* (HTTP 200) and the UI treats HTML as data.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        timeout: 10_000,
        proxyTimeout: 10_000,
        configure(proxy) {
          proxy.on('error', (err, _req, res) => {
            const payload = JSON.stringify({
              error: 'API unreachable',
              code: (err as NodeJS.ErrnoException).code ?? 'ECONNREFUSED',
            });
            if (res && 'writeHead' in res && typeof res.writeHead === 'function') {
              if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
              }
              res.end(payload);
              return;
            }
          });
        },
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
